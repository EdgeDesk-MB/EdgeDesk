import { eq } from "drizzle-orm";
import "server-only";
import {
  db,
  accounts,
  balanceTransactions,
  bets,
  events,
  offers,
  offerSeries,
  type BetRow,
  type OfferRow,
} from "@/lib/db";
import { getPromoAwardsByBetId } from "@/lib/services/balances";
import {
  writeEvLock,
  fillSettlementSnapshot,
  getAllSnapshots,
  getSnapshotsForOffer,
} from "@/lib/services/ev-snapshot";
import { captureSummary, type EvSnapshotRow } from "@/lib/offers/ev-capture";
import { deriveOfferPipelineStage, earliestOpenBetEventAt } from "@/lib/offers/pipeline";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";
import { getOfferRecurrenceMeta, syncOfferSeriesInstances } from "@/lib/offers/offer-recurrence";
import { localYmd } from "@/lib/offers/offer-recurrence-shared";
import {
  ensureSameDayOfferSiblings,
  reconcileSameDayOfferSiblings,
  retireUnusedSameDayOfferSiblings,
} from "@/lib/offers/course-offer-sync";
import {
  applyDepositEvidenceToPlaybook,
  findDepositEvidence,
  playbooksEqual,
  readPlaybookFromRulesJson,
  syncClearWageringFromBookieWr,
  syncPlaybookFromOfferProfit,
  withPlaybookOnRules,
} from "@/lib/offers/offer-playbook";
import { readImportantTerms } from "@/lib/offers/offer-terms";
import { quietOfferAlerts } from "@/lib/services/quiet-alerts";
import { listPendingRemindersByOfferIds } from "@/lib/services/user-reminders";
import { indexOfferDeskProgress } from "@/lib/offers/offer-desk-progress";
import { listAccaRuns } from "@/lib/services/acca-desk";
import { listBetBuilderRuns } from "@/lib/services/bet-builder-desk";
import { listSystemRuns } from "@/lib/services/systems-desk";

export type {
  FreeBetStage,
  OfferProfitBreakdown,
  OfferSummary,
} from "@/lib/services/offers.types";
import type { OfferProfitBreakdown, OfferSummary } from "@/lib/services/offers.types";

import {
  computeOfferProfitBreakdown as computeOfferProfitBreakdownPure,
  summariseOffer as summariseOfferPure,
} from "@/lib/offers/offer-profit";

export { expectedFreeBetAmountFromBet } from "@/lib/offers/offer-profit";

/** SQLite-backed wrapper: defaults promo awards from the local ledger. */
export function computeOfferProfitBreakdown(
  linkedInput: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }> = getPromoAwardsByBetId()
): OfferProfitBreakdown {
  return computeOfferProfitBreakdownPure(linkedInput, promoAwards);
}

/** Detect offer-like text from label or AI trigger field. */
export function inferOfferTitle(label: string, triggerText?: string | null): string | null {
  const raw = (triggerText?.trim() || label.trim()).replace(/\s+/g, " ");
  if (!raw) return null;
  if (/\b(get|gives?|award|free bet|fb\b|refund|money back|2nd|3rd|4th|place)\b/i.test(raw)) {
    return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
  }
  if (/\bbet\s+£?\d+/i.test(raw) && /\b(get|£)\s*£?\d+/i.test(raw)) return raw;
  return null;
}

/** Normalise promo titles so "£50FB" / "£50 free bet" / place lists compare equal. */
export function normalizeOfferTitleKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/£\s*/g, "£")
    .replace(/\bfree\s*bets?\b/g, "fb")
    .replace(/\bfb\b/g, "fb")
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/[–-−]/g, "-")
    .replace(/[^a-z0-9£]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStakePair(text: string): { bet: number; free: number } | null {
  const m = text.match(
    /bet\s*£?\s*(\d+(?:\.\d{1,2})?)\s*(?:get|gives?|for)\s*£?\s*(\d+(?:\.\d{1,2})?)/i
  );
  if (!m) return null;
  return { bet: Number(m[1]), free: Number(m[2]) };
}

function extractPlaceTokens(text: string): string {
  const places = [...text.toLowerCase().matchAll(/\b(\d)(?:st|nd|rd|th)?\b/g)]
    .map((m) => m[1])
    .filter((n) => Number(n) >= 2 && Number(n) <= 6);
  return [...new Set(places)].sort().join(",");
}

/**
 * Prefer linking to an existing active/planned campaign over creating a duplicate.
 * Matches bookmaker + stake pair + similar title (place-refund wording varies).
 */
export function findMatchingOpenOffer(input: {
  title: string;
  bookmaker?: string | null;
}): OfferRow | null {
  const bookie = input.bookmaker?.trim().toLowerCase() || null;
  const titleKey = normalizeOfferTitleKey(input.title);
  const stakes = extractStakePair(input.title);
  const places = extractPlaceTokens(input.title);

  const todayKey = localYmd(new Date());

  const candidates = db
    .select()
    .from(offers)
    .all()
    .filter((o) => o.status === "active" || o.status === "planned");

  type Scored = { offer: OfferRow; score: number };
  const scored: Scored[] = [];

  for (const offer of candidates) {
    if (
      offer.seriesId != null &&
      offer.instanceDate != null &&
      offer.instanceDate !== todayKey
    ) {
      continue;
    }
    const offerBookie = offer.bookmaker?.trim().toLowerCase() || null;
    if (bookie && offerBookie && bookie !== offerBookie) continue;

    const offerKey = normalizeOfferTitleKey(offer.title);
    const offerStakes = extractStakePair(offer.title);
    const offerPlaces = extractPlaceTokens(offer.title);

    let score = 0;
    if (titleKey && offerKey && (titleKey === offerKey || titleKey.includes(offerKey) || offerKey.includes(titleKey))) {
      score += 80;
    }
    if (stakes && offerStakes) {
      if (Math.abs(stakes.bet - offerStakes.bet) < 0.02) score += 40;
      else score -= 20;
      if (Math.abs(stakes.free - offerStakes.free) < 0.02) score += 40;
      else score -= 20;
    }
    if (places && offerPlaces && places === offerPlaces) score += 25;
    else if (places && offerPlaces && places !== offerPlaces) score -= 5;

    if (bookie && offerBookie && bookie === offerBookie) score += 15;
    if (offer.sport === "horse_racing" || offer.offerType === "bet_get_free_place") score += 5;
    // Prefer campaigns with expected profit / race scope (real calendar offers)
    if (offer.expectedProfit != null && Math.abs(offer.expectedProfit) > 0.01) score += 10;
    if (offer.eventDate || offer.scopeCourse || offer.scopeRaceId) score += 8;

    if (score >= 70) scored.push({ offer, score });
  }

  scored.sort((a, b) => b.score - a.score || b.offer.createdAt - a.offer.createdAt);
  return scored[0]?.offer ?? null;
}

export function resolveOfferForBet(input: {
  offerId?: number | null;
  label: string;
  triggerText?: string | null;
  bookmaker?: string | null;
  expectedProfit?: number | null;
}): number | null {
  if (input.offerId != null && input.offerId > 0) {
    const existing = db.select().from(offers).where(eq(offers.id, input.offerId)).get();
    if (existing) return existing.id;
  }

  const title = inferOfferTitle(input.label, input.triggerText);
  if (!title) return null;

  const matched = findMatchingOpenOffer({
    title,
    bookmaker: input.bookmaker,
  });
  if (matched) return matched.id;

  const now = Date.now();
  const inserted = db
    .insert(offers)
    .values({
      bookmaker: input.bookmaker?.trim() || null,
      title,
      description: input.triggerText?.trim() || input.label.trim() || null,
      expectedProfit: input.expectedProfit ?? null,
      status: "active",
      createdAt: now,
    })
    .returning()
    .get();

  // Write EV lock v1 for the new active offer (minimal summary — no bets yet).
  const minSummary = summariseOffer(inserted, []);
  writeEvLock(minSummary, inserted.expectedProfit != null ? { expectedProfit: inserted.expectedProfit } : undefined);

  return inserted.id;
}

/**
 * Link SNR/SR conversion bets to an offer that already awarded a free bet.
 *
 * Default: only honour an **explicit** `offerId` (Convert CTA, Acca desk,
 * Add bet offer picker). Inferring from bookie+stake alone used to pull
 * unrelated free bets (e.g. a cricket selection) onto whatever campaign was
 * sitting in "awarded" — pass `allowInfer: true` only for backfill/repair.
 */
export function resolveOfferForFreeBetUsage(input: {
  offerId?: number | null;
  betType: string;
  bookmaker?: string | null;
  /** Free-bet stake - prefer campaigns whose award amount matches */
  backStake?: number | null;
  /** Infer a campaign when no offerId was chosen (backfill only). */
  allowInfer?: boolean;
}): number | null {
  if (input.offerId != null && input.offerId > 0) return input.offerId;
  if (input.betType !== "free_snr" && input.betType !== "free_sr") return null;
  if (!input.allowInfer) return null;

  const bookie = input.bookmaker?.trim().toLowerCase() || null;
  const stake = input.backStake != null && input.backStake > 0 ? input.backStake : null;

  const promoAwards = getPromoAwardsByBetId();
  const allOffers = db.select().from(offers).all();
  const allBets = db.select().from(bets).all();

  type Candidate = {
    offerId: number;
    score: number;
    createdAt: number;
  };
  const scored: Candidate[] = [];

  for (const offer of allOffers) {
    if (offer.status !== "active" && offer.status !== "completed") continue;

    const linked = allBets.filter((b) => b.offerId === offer.id);
    const breakdown = computeOfferProfitBreakdown(linked, promoAwards);
    if (!(breakdown.freeBetAwarded && breakdown.freeBetStage === "awarded")) continue;

    const offerBookie = offer.bookmaker?.trim().toLowerCase() || null;

    // Infer path: require bookie + exact award stake so a £10 cricket FB
    // cannot land on a £50 racing campaign (or any other mismatch).
    if (!bookie || !offerBookie || bookie !== offerBookie) continue;
    if (
      stake == null ||
      breakdown.freeBetAwardAmount == null ||
      Math.abs(breakdown.freeBetAwardAmount - stake) >= 0.02
    ) {
      continue;
    }

    scored.push({
      offerId: offer.id,
      score: 100,
      createdAt: offer.createdAt,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
  const best = scored[0];
  if (!best || best.score < 5) return null;
  return best.offerId;
}

function buildDeskProgressIndex() {
  return indexOfferDeskProgress({
    acca: listAccaRuns().map(({ run, legs }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      method: run.method,
      noLay: run.noLay,
      wholeLayStake: run.wholeLayStake,
      legs: legs.map((l) => ({
        seq: l.seq,
        label: l.label,
        result: l.result,
        layStake: l.layStake,
      })),
    })),
    betBuilder: listBetBuilderRuns().map(({ run, selections }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      method: run.method,
      wholeLayStake: run.wholeLayStake,
      selectionCount: selections.length,
    })),
    systems: listSystemRuns().map(({ run, legs }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      legs: legs.map((l) => ({
        seq: l.seq,
        label: l.label,
        result: l.result,
      })),
    })),
  });
}

export function summariseOffer(
  offer: OfferRow,
  linkedInput: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }> = getPromoAwardsByBetId()
): OfferSummary {
  return summariseOfferPure(offer, linkedInput, promoAwards);
}

export function listOfferSummaries(): OfferSummary[] {
  const allOffers = db.select().from(offers).all();
  const allBets = db.select().from(bets).all();
  const allEvents = db.select().from(events).all();
  const eventsById = new Map(allEvents.map((e) => [e.id, e]));
  const seriesRows = db.select().from(offerSeries).all();
  const seriesById = new Map(seriesRows.map((s) => [s.id, s]));
  const promoAwards = getPromoAwardsByBetId();

  // Load all snapshots once and group by offerId
  const allSnaps = getAllSnapshots() as EvSnapshotRow[];
  const snapsByOffer = new Map<number, EvSnapshotRow[]>();
  for (const s of allSnaps) {
    const list = snapsByOffer.get(s.offerId) ?? [];
    list.push(s);
    snapsByOffer.set(s.offerId, list);
  }

  const remindersByOffer = listPendingRemindersByOfferIds(allOffers.map((o) => o.id));
  const deskByOffer = buildDeskProgressIndex();

  return allOffers
    .map((o) => {
      const linked = allBets.filter((b) => b.offerId === o.id);
      const summary = summariseOffer(o, linked, promoAwards);
      const recurrence = getOfferRecurrenceMeta(o, seriesById.get(o.seriesId ?? -1) ?? null);
      let snaps = snapsByOffer.get(o.id) ?? [];

      const stage = deriveOfferPipelineStage(summary);

      // Catch-all: any active offer that reached this list unlocked (API create,
      // recurrence instance, daily roll) gets its v1 lock now. Never lock a campaign
      // whose outcome is already known - a post-hoc baseline is not a baseline.
      if (snaps.length === 0 && o.status === "active" && stage !== "settled" && stage !== "expired") {
        const v = writeEvLock(summary, { onlyIfUnlocked: true });
        if (v != null) snaps = getSnapshotsForOffer(o.id) as EvSnapshotRow[];
      }

      // Fill settlement data if the campaign just became settled or expired.
      // Expired campaigns wait for open legs to settle so the fill is truly realized
      // (an expired unstarted campaign records realized 0 - lost EV is real signal).
      const fillable =
        stage === "settled" || (stage === "expired" && summary.openBets === 0);
      if (fillable && snaps.length > 0) {
        const latest = snaps.reduce((best, s) => (s.version > best.version ? s : best));
        if (latest.settledAt == null) {
          // Commission drag: sum layStake * commission for bets where back lost
          // (lay won). Mug bets are excluded - drag must match the realised
          // side, which computeOfferProfitBreakdown already filters.
          const drag = linked
            .filter((b) => b.purpose !== "mug" && b.status === "lost" && b.layStake > 0)
            .reduce((sum, b) => sum + b.layStake * b.commission, 0);
          fillSettlementSnapshot(o.id, summary.profit.totalProfit, drag);
          // Refresh the snapshot list so evLock reflects the fill
          latest.realizedProfit = summary.profit.totalProfit;
          latest.capturePct =
            Math.abs(latest.expectedProfit) > 0.01
              ? Math.min(summary.profit.totalProfit / latest.expectedProfit, 2)
              : null;
          latest.settledAt = Date.now();
        }
      }

      const evLock = captureSummary(snaps);
      return {
        ...summary,
        recurrence,
        evLock,
        reminders: remindersByOffer.get(o.id) ?? [],
        awaitingEventAt: earliestOpenBetEventAt(linked, eventsById),
        deskProgress: deskByOffer.get(o.id) ?? null,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export { syncOfferSeriesInstances } from "@/lib/offers/offer-recurrence";

function normalizeOfferRulesJson(rules: string | null): string | null {
  if (!rules?.trim()) return rules;
  try {
    const parsed = JSON.parse(rules) as { importantNotes?: string | null };
    if (typeof parsed.importantNotes !== "string") return rules;
    const next = normalizeOfferDetailsText(parsed.importantNotes);
    if (next === parsed.importantNotes) return rules;
    return JSON.stringify({ ...parsed, importantNotes: next || null });
  } catch {
    return rules;
  }
}

/** Idempotent: rewrite stored offer copy to decimal odds (and ordinal place phrasing). */
export function normalizeAllOfferOddsText(): number {
  let updated = 0;

  for (const row of db.select().from(offers).all()) {
    const description = row.description
      ? normalizeOfferDetailsText(row.description)
      : row.description;
    const rules = normalizeOfferRulesJson(row.rules);
    if (description !== row.description || rules !== row.rules) {
      db.update(offers)
        .set({ description, rules })
        .where(eq(offers.id, row.id))
        .run();
      updated += 1;
    }
  }

  for (const row of db.select().from(offerSeries).all()) {
    const description = row.description
      ? normalizeOfferDetailsText(row.description)
      : row.description;
    const rules = normalizeOfferRulesJson(row.rules);
    if (description !== row.description || rules !== row.rules) {
      db.update(offerSeries)
        .set({ description, rules })
        .where(eq(offerSeries.id, row.id))
        .run();
      updated += 1;
    }
  }

  return updated;
}

/**
 * True when the campaign has nothing left to do - including free-bet conversion.
 * Qualifying-only settlement is NOT enough when a free bet is awarded or still in use.
 */
export function isOfferCampaignComplete(
  linkedBets: BetRow[],
  profit: OfferProfitBreakdown
): boolean {
  if (linkedBets.length === 0) return false;
  if (linkedBets.some((b) => b.status === "open")) return false;

  // Free bet sitting unused, or conversion legs still open - keep campaign active.
  if (profit.freeBetStage === "awarded" || profit.freeBetStage === "in_use") {
    return false;
  }
  if (profit.freeBetStage === "awaiting_result") return false;

  return true;
}

export {
  canManuallyCompleteOffer,
  offerManualCompleteBlockedReason,
} from "@/lib/offers/offer-complete";

/** Mark offers completed when the full campaign is done; reopen if free bet still pending. */
export function syncOfferStatuses(): void {
  normalizeAllOfferOddsText();
  const now = Date.now();
  const todayKey = localYmd(new Date(now));
  const allOffers = db.select().from(offers).all();
  const allBets = db.select().from(bets).all();
  const promoAwards = getPromoAwardsByBetId();

  for (const offer of allOffers) {
    const linkedBets = allBets.filter((b) => b.offerId === offer.id);
    const profit = computeOfferProfitBreakdown(linkedBets, promoAwards);

    // Repair: expired against a deadline that has since moved, e.g. a race
    // off-time that used to be misread as the small hours. A manual expire
    // stamps expiresAt to now (see PATCH /api/offers), so it is not revived.
    // Played campaigns that finished cleanly upgrade Missed race → completed.
    // Do NOT reopen incomplete expired campaigns (awarded FB, etc.) - that
    // undid Expire in the UI the moment state refreshed.
    if (offer.status === "expired") {
      const deadline = effectiveOfferExpiryMs(offer);
      if (deadline != null && deadline > now) {
        const notYetStarted = offer.startsOn != null && offer.startsOn > todayKey;
        db.update(offers)
          .set({ status: notYetStarted ? "planned" : "active" })
          .where(eq(offers.id, offer.id))
          .run();
        continue;
      }
      if (linkedBets.length > 0 && isOfferCampaignComplete(linkedBets, profit)) {
        db.update(offers)
          .set({ status: "completed", completedAt: now })
          .where(eq(offers.id, offer.id))
          .run();
        quietOfferAlerts(offer.id, now);
        retireUnusedSameDayOfferSiblings(offer.id);
      }
      continue;
    }

    // Repair: completed too early (qualifying settled, free bet never converted).
    if (offer.status === "completed") {
      if (
        profit.freeBetStage === "awarded" ||
        profit.freeBetStage === "in_use" ||
        profit.freeBetStage === "awaiting_result"
      ) {
        db.update(offers)
          .set({ status: "active", completedAt: null })
          .where(eq(offers.id, offer.id))
          .run();
      }
      continue;
    }

    // A scheduled "Starts on" date arriving is as good a trigger as a first bet.
    const readyToGoLive = offer.startsOn != null && offer.startsOn <= todayKey;

    if (offer.status === "planned" && (linkedBets.length > 0 || readyToGoLive)) {
      db.update(offers).set({ status: "active" }).where(eq(offers.id, offer.id)).run();
      // Write EV lock v1 for the newly-active offer (if not already locked).
      const activeSummary = summariseOffer({ ...offer, status: "active" }, linkedBets, promoAwards);
      writeEvLock(activeSummary, { onlyIfUnlocked: true });
      // Fall through - may also be past scoped race/expiry.
    }

    // Don't auto-expire campaigns that still have open bets or an unused free bet.
    const busy =
      linkedBets.some((b) => b.status === "open") ||
      profit.freeBetStage === "awarded" ||
      profit.freeBetStage === "in_use" ||
      profit.freeBetStage === "awaiting_result";

    const deadline = effectiveOfferExpiryMs(offer);
    // Missed race / expired = window passed with no play. Settled campaigns
    // (e.g. place-refund horse won → free bet not awarded) complete instead.
    if (!busy && deadline != null && deadline < now) {
      if (linkedBets.length === 0) {
        db.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id)).run();
        quietOfferAlerts(offer.id, now);
        continue;
      }
      if (isOfferCampaignComplete(linkedBets, profit)) {
        db.update(offers)
          .set({ status: "completed", completedAt: now })
          .where(eq(offers.id, offer.id))
          .run();
        quietOfferAlerts(offer.id, now);
        retireUnusedSameDayOfferSiblings(offer.id);
        continue;
      }
    }

    if (offer.status === "planned" && linkedBets.length === 0) continue;

    if (isOfferCampaignComplete(linkedBets, profit)) {
      db.update(offers)
        .set({ status: "completed", completedAt: now })
        .where(eq(offers.id, offer.id))
        .run();
      quietOfferAlerts(offer.id, now);
      retireUnusedSameDayOfferSiblings(offer.id);
    }
  }

  // Drop unused same-day twins for one-shot / series groups once a play is
  // underway / done. Multi-use (`repeatSameDay`) groups keep their fresh card.
  reconcileSameDayOfferSiblings();

  syncOfferPlaybooksFromLedger(now);
}

/**
 * O1 Phase 2: keep offer playbooks in sync with ledger evidence —
 * deposit credits, bet-linked profit stages, and clear-wagering WR watch.
 */
export function syncOfferPlaybooksFromLedger(now = Date.now()): number {
  const allAccounts = db.select().from(accounts).all();
  const allTx = db.select().from(balanceTransactions).all();
  const allBets = db.select().from(bets).all();
  const promoAwards = getPromoAwardsByBetId();
  const wrAccounts = allAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    wrRemaining: a.wrRemaining ?? 0,
  }));
  let updated = 0;

  for (const offer of db.select().from(offers).all()) {
    if (offer.status !== "active" && offer.status !== "planned") continue;
    const playbook = readPlaybookFromRulesJson(offer.rules);
    if (!playbook) continue;

    let next = playbook;
    const important = readImportantTerms(offer);

    const deposit = next.steps.find((s) => s.kind === "deposit");
    if (deposit && deposit.status !== "done") {
      const evidence = findDepositEvidence({
        bookmaker: offer.bookmaker,
        minDeposit: important.minDeposit,
        notBeforeMs: offer.createdAt,
        accounts: allAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
        transactions: allTx.map((t) => ({
          id: t.id,
          accountId: t.accountId,
          amount: t.amount,
          category: t.category,
          createdAt: t.createdAt,
        })),
      });
      if (evidence) {
        next = applyDepositEvidenceToPlaybook(next, evidence, now);
      }
    }

    const linked = allBets.filter((b) => b.offerId === offer.id);
    const profit = computeOfferProfitBreakdown(linked, promoAwards);
    next = syncPlaybookFromOfferProfit(next, profit, now);

    const convertDone = next.steps.find((s) => s.kind === "convert")?.status === "done";
    const convertComplete =
      convertDone ||
      profit.freeBetStage === "in_use" ||
      profit.freeBetStage === "settled";

    next = syncClearWageringFromBookieWr(
      next,
      {
        bookmaker: offer.bookmaker,
        accounts: wrAccounts,
        convertComplete,
      },
      now
    );

    if (playbooksEqual(playbook, next)) continue;

    try {
      const parsed = offer.rules
        ? (JSON.parse(offer.rules) as Record<string, unknown>)
        : { type: "promo_terms" };
      const rules = JSON.stringify(withPlaybookOnRules(parsed, next));
      db.update(offers).set({ rules }).where(eq(offers.id, offer.id)).run();
      updated += 1;
    } catch {
      // leave rules untouched
    }
  }
  return updated;
}

/**
 * Spawn a fresh same-day twin when a `repeatSameDay` place-refund group is
 * fully used. One-shot / series campaigns no-op. Call only after bet
 * create/link; orphan one-shot twins are retired on status sync.
 */
export function spawnSameDayOfferSiblingsIfNeeded(): void {
  const allBets = db.select().from(bets).all();
  ensureSameDayOfferSiblings(db.select().from(offers).all(), allBets);
}

/** @deprecated Prefer spawnSameDayOfferSiblingsIfNeeded. */
export function spawnCourseOfferSiblingsIfNeeded(): void {
  spawnSameDayOfferSiblingsIfNeeded();
}

/** Backfill offers for existing bets that look like promos but have no offer_id. */
export function backfillOffersFromBets(): number {
  let updated = 0;

  // Pass 1: create/link qualifying promo bets (never free-bet usage - those attach below).
  for (const bet of db.select().from(bets).all().filter((b) => b.offerId == null)) {
    // Imported history was never EV-locked - linking it to campaigns would
    // pollute capture-rate data (E3 provenance invariant).
    if (bet.source === "import") continue;
    if (bet.betType === "free_snr" || bet.betType === "free_sr") continue;
    const offerId = resolveOfferForBet({
      label: bet.label,
      triggerText: bet.triggerText,
      bookmaker: bet.bookmaker,
      expectedProfit: bet.expectedProfit,
    });
    if (offerId != null) {
      db.update(bets).set({ offerId }).where(eq(bets.id, bet.id)).run();
      updated += 1;
    }
  }

  // Pass 2: attach SNR/SR conversions to awarded campaigns (bookie optional).
  // Infer is intentional here — repair orphan free bets; live Add bet does not.
  for (const bet of db.select().from(bets).all().filter((b) => b.offerId == null)) {
    if (bet.source === "import") continue;
    const offerId = resolveOfferForFreeBetUsage({
      betType: bet.betType,
      bookmaker: bet.bookmaker,
      backStake: bet.backStake,
      allowInfer: true,
    });
    if (offerId != null) {
      db.update(bets).set({ offerId }).where(eq(bets.id, bet.id)).run();
      updated += 1;
    }
  }

  return updated;
}
