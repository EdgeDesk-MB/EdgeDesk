import { eq } from "drizzle-orm";
import { db, bets, offers, type BetRow, type OfferRow } from "@/lib/db";
import { getPromoAwardsByBetId } from "@/lib/services/balances";
import { aiEffectsForBet, isPlaceFreeBetEffect } from "@/lib/calc/ai-triggers";

export type FreeBetStage =
  | "none"
  | "awaiting_result"
  | "not_awarded"
  | "awarded"
  | "in_use"
  | "settled";

export interface OfferProfitBreakdown {
  /** Sum of settled qualifying / risk-free bet P&L */
  qualifyingProfit: number;
  qualifyingSettledCount: number;
  qualifyingOpenCount: number;
  /** Whether a promo free bet was credited on a qualifying bet */
  freeBetAwarded: boolean;
  freeBetAwardAmount: number | null;
  freeBetAwardReason: string | null;
  freeBetStage: FreeBetStage;
  /** Settled SNR/SR free-bet conversion P&L */
  freeBetProfit: number;
  freeBetOpenCount: number;
  freeBetSettledCount: number;
  /** qualifying + free bet usage */
  totalProfit: number;
}

export interface OfferSummary extends OfferRow {
  betCount: number;
  openBets: number;
  actualProfit: number;
  expectedFromBets: number;
  profit: OfferProfitBreakdown;
}

function isQualifyingBet(bet: BetRow): boolean {
  return bet.betType === "qualifying" || bet.betType === "risk_free";
}

function isFreeBetUsage(bet: BetRow): boolean {
  return bet.betType === "free_snr" || bet.betType === "free_sr";
}

function settledProfit(bets: BetRow[]): number {
  return bets
    .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
    .reduce((a, b) => a + (b.actualProfit ?? 0), 0);
}

/** Free-bet award amount implied by label/trigger (even if wallet credit failed). */
export function expectedFreeBetAmountFromBet(bet: BetRow): number | null {
  const fromRuleOrLabel = aiEffectsForBet(bet.triggerRule, bet.label);
  const fromTriggerText = bet.triggerText?.trim()
    ? aiEffectsForBet(null, bet.triggerText)
    : [];
  const effects = fromRuleOrLabel.length > 0 ? fromRuleOrLabel : fromTriggerText;
  const award = effects.find((e) => e.kind === "free_bet_award");
  return award && award.amount > 0 ? award.amount : null;
}

function freeBetEffectsForBet(bet: BetRow) {
  const fromRuleOrLabel = aiEffectsForBet(bet.triggerRule, bet.label);
  if (fromRuleOrLabel.length > 0) return fromRuleOrLabel;
  if (bet.triggerText?.trim()) return aiEffectsForBet(null, bet.triggerText);
  return [];
}

function betHasPlaceFreeBetTrigger(bet: BetRow): boolean {
  return freeBetEffectsForBet(bet).some(isPlaceFreeBetEffect);
}

function betHasUnconditionalFreeBet(bet: BetRow): boolean {
  return freeBetEffectsForBet(bet).some(
    (e) => e.kind === "free_bet_award" && e.positions.length === 0
  );
}

export function computeOfferProfitBreakdown(
  linked: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }> = getPromoAwardsByBetId()
): OfferProfitBreakdown {
  const qualifying = linked.filter(isQualifyingBet);
  const freeBetBets = linked.filter(isFreeBetUsage);

  const qualifyingSettled = qualifying.filter((b) => b.status !== "open" && b.status !== "void");
  const qualifyingOpen = qualifying.filter((b) => b.status === "open");
  const qualifyingProfit = settledProfit(qualifying);

  const freeBetSettled = freeBetBets.filter((b) => b.status !== "open" && b.status !== "void");
  const freeBetOpen = freeBetBets.filter((b) => b.status === "open");
  const freeBetProfit = settledProfit(freeBetBets);

  let freeBetAwarded = false;
  let freeBetAwardAmount: number | null = null;
  let freeBetAwardReason: string | null = null;

  for (const bet of qualifying) {
    const promo = promoAwards[bet.id];
    if (!promo) continue;
    freeBetAwarded = true;
    freeBetAwardAmount = promo.amount;
    freeBetAwardReason = promo.reason;
    break;
  }

  // Unconditional "Bet £X get £Y FB" — treat as awarded once qualifying settles,
  // even if the bookie wallet credit never landed (missing account, etc.).
  if (!freeBetAwarded && freeBetSettled.length === 0 && freeBetOpen.length === 0) {
    for (const bet of qualifyingSettled) {
      if (!betHasUnconditionalFreeBet(bet)) continue;
      const amount = expectedFreeBetAmountFromBet(bet);
      if (amount == null) continue;
      freeBetAwarded = true;
      freeBetAwardAmount = amount;
      freeBetAwardReason = "Offer unlocked";
      break;
    }
  }

  let freeBetStage: FreeBetStage = "none";
  const hasPlaceTrigger = qualifying.some(betHasPlaceFreeBetTrigger);
  const hasAnyFreeBetTrigger = qualifying.some((b) => expectedFreeBetAmountFromBet(b) != null);

  if (freeBetSettled.length > 0) {
    freeBetStage = "settled";
  } else if (freeBetOpen.length > 0) {
    freeBetStage = "in_use";
  } else if (freeBetAwarded) {
    freeBetStage = "awarded";
  } else if (hasPlaceTrigger && qualifyingOpen.length > 0) {
    freeBetStage = "awaiting_result";
  } else if (hasPlaceTrigger && qualifyingSettled.length > 0) {
    freeBetStage = "not_awarded";
  } else if (hasAnyFreeBetTrigger && qualifyingOpen.length > 0) {
    freeBetStage = "awaiting_result";
  }

  return {
    qualifyingProfit,
    qualifyingSettledCount: qualifyingSettled.length,
    qualifyingOpenCount: qualifyingOpen.length,
    freeBetAwarded,
    freeBetAwardAmount,
    freeBetAwardReason,
    freeBetStage,
    freeBetProfit,
    freeBetOpenCount: freeBetOpen.length,
    freeBetSettledCount: freeBetSettled.length,
    totalProfit: qualifyingProfit + freeBetProfit,
  };
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
  return inserted.id;
}

/** Link SNR/SR conversion bets to an offer that already awarded a free bet. */
export function resolveOfferForFreeBetUsage(input: {
  offerId?: number | null;
  betType: string;
  bookmaker?: string | null;
}): number | null {
  if (input.offerId != null && input.offerId > 0) return input.offerId;
  if (input.betType !== "free_snr" && input.betType !== "free_sr") return null;

  const bookie = input.bookmaker?.trim().toLowerCase();
  if (!bookie) return null;

  const promoAwards = getPromoAwardsByBetId();
  const allOffers = db.select().from(offers).all();
  const allBets = db.select().from(bets).all();

  const candidates = allOffers
    .filter(
      (o) =>
        (o.status === "active" || o.status === "completed") &&
        o.bookmaker?.trim().toLowerCase() === bookie
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  for (const offer of candidates) {
    const linked = allBets.filter((b) => b.offerId === offer.id);
    const breakdown = computeOfferProfitBreakdown(linked, promoAwards);
    if (breakdown.freeBetAwarded && breakdown.freeBetStage === "awarded") {
      return offer.id;
    }
  }
  return null;
}

export function summariseOffer(
  offer: OfferRow,
  linked: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }> = getPromoAwardsByBetId()
): OfferSummary {
  const openBets = linked.filter((b) => b.status === "open").length;
  const profit = computeOfferProfitBreakdown(linked, promoAwards);
  const expectedFromBets = linked.reduce((a, b) => a + (b.expectedProfit ?? 0), 0);

  return {
    ...offer,
    betCount: linked.length,
    openBets,
    actualProfit: profit.totalProfit,
    expectedFromBets,
    profit,
  };
}

export function listOfferSummaries(): OfferSummary[] {
  const allOffers = db.select().from(offers).all();
  const allBets = db.select().from(bets).all();
  return allOffers
    .map((o) => summariseOffer(o, allBets.filter((b) => b.offerId === o.id)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * True when the campaign has nothing left to do — including free-bet conversion.
 * Qualifying-only settlement is NOT enough when a free bet is awarded or still in use.
 */
export function isOfferCampaignComplete(
  linkedBets: BetRow[],
  profit: OfferProfitBreakdown
): boolean {
  if (linkedBets.length === 0) return false;
  if (linkedBets.some((b) => b.status === "open")) return false;

  // Free bet sitting unused, or conversion legs still open — keep campaign active.
  if (profit.freeBetStage === "awarded" || profit.freeBetStage === "in_use") {
    return false;
  }
  if (profit.freeBetStage === "awaiting_result") return false;

  return true;
}

/** Mark offers completed when the full campaign is done; reopen if free bet still pending. */
export function syncOfferStatuses(): void {
  const now = Date.now();
  const allOffers = db.select().from(offers).all();
  const allBets = db.select().from(bets).all();
  const promoAwards = getPromoAwardsByBetId();

  for (const offer of allOffers) {
    if (offer.status === "expired") continue;

    const linkedBets = allBets.filter((b) => b.offerId === offer.id);
    const profit = computeOfferProfitBreakdown(linkedBets, promoAwards);

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

    if (offer.status === "planned" && linkedBets.length > 0) {
      db.update(offers).set({ status: "active" }).where(eq(offers.id, offer.id)).run();
      continue;
    }

    if (offer.expiresAt != null && offer.expiresAt < now) {
      db.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id)).run();
      continue;
    }

    if (isOfferCampaignComplete(linkedBets, profit)) {
      db.update(offers)
        .set({ status: "completed", completedAt: now })
        .where(eq(offers.id, offer.id))
        .run();
    }
  }
}

/** Backfill offers for existing bets that look like promos but have no offer_id. */
export function backfillOffersFromBets(): number {
  const allBets = db.select().from(bets).all();
  let updated = 0;

  for (const bet of allBets.filter((b) => b.offerId == null)) {
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

  for (const bet of allBets.filter((b) => b.offerId == null)) {
    const offerId = resolveOfferForFreeBetUsage({
      betType: bet.betType,
      bookmaker: bet.bookmaker,
    });
    if (offerId != null) {
      db.update(bets).set({ offerId }).where(eq(bets.id, bet.id)).run();
      updated += 1;
    }
  }

  return updated;
}
