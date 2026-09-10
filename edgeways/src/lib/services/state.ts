/**
 * Central state service: ticks simulations forward, refreshes live API events,
 * auto-settles bets on finished events, and computes the live P&L picture.
 */
import { eq, inArray } from "drizzle-orm";
import "server-only";
import {
  accounts as accountsTable,
  bets,
  casinoOffers,
  db,
  events,
  history,
  isDemoMode,
  mugPlans,
  offerEffortSamples,
  offers,
  type BetRow,
  type EventRow,
  type HistoryRow,
} from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { buildNeonDeskAppState } from "@/lib/db/neon-desk-state";
import { isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { isLockInLoggedBet } from "@/lib/bets/lock-in-bets";
import { isBetBuilderDeskBack, isBetBuilderDeskLay } from "@/lib/bets/bet-builder-desk-bets";
import { isSystemsDeskBack } from "@/lib/bets/systems-desk-bets";
import { buildDeskLivePositions } from "@/lib/pnl/desk-live-positions";
import {
  hasBetWinTrigger,
  parseBetTriggerRule,
  toMatchResult,
  toSettleable,
  toTriggerContext,
} from "@/lib/bets/settle-inputs";
import { footballFtResultReady } from "@/lib/events/football-full-time";
import {
  backfillMissingCasinoOfferBalances,
  ledgerFromSettledBet,
  getBalanceSummary,
  getPromoAwardsByBetId,
  ledgerPromoAward,
} from "@/lib/services/balances";
import { computePnlBuckets } from "@/lib/pnl/pnl-buckets";
import {
  accaCampaignSettledProfit,
  activeAccaDeskLayBetIds,
  completedAccaDeskLinkedBetIds,
  completedAccaSeriesPoints,
  isDeferredAccaDeskLaySettlement,
  sumAccaSquareProvisional,
} from "@/lib/pnl/acca-provisional";
import { countBoostsNeedingAction } from "@/lib/services/boosts";
import type { BalanceSummary } from "@/lib/services/balances.types";
import { simStateAt, type SimGoal } from "./sim";
import {
  fixtureLineups,
  fixtureMatchEvents,
  fixturesByIds,
  hasApiKey,
  apiUsageToday,
} from "./apifootball";
import {
  syncRacingResultsForOpenBets,
  syncRecentTrackedRacingResults,
} from "@/lib/services/sync-racing-results";
import {
  getCachedRacingResultsTier,
  hasRacingApiKey,
  racingApiUsageToday,
  resolveRacingResultsTier,
  type RacingResultsTier,
} from "@/lib/services/theracingapi";
import {
  getAllExchangeProviderStatuses,
  getDefaultExchangeName,
  getDefaultExchangeProvider,
  getExchangeProviderStatus,
} from "@/lib/services/exchange";
import type { ExchangeProviderStatus } from "@/lib/services/exchange/types";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";
import {
  sumLiveChartProvisional,
  sumOpenWorstCaseProfit,
} from "@/lib/pnl/open-bet-worst-case";
import {
  freeBetAwardPhrase,
  freeBetEffectsForBet,
} from "@/lib/offers/early-free-bet-award";
import {
  evaluateFreeBetAward,
  evaluateUnconditionalFreeBet,
  isPlaceFreeBetEffect,
  evaluateTrigger,
  provisionalProfit,
  settleBet,
  settleFromOutcome,
  racingMarketReadyToSettle,
  settleRacingBet,
  triggerIfEndedNow,
  type TriggerRule,
} from "@/lib/calc";
import { commissionPaidOnSettledBet } from "@/lib/calc/commission-paid";
import {
  isRaceResultIncomplete,
  parseRaceResults,
  racingEventStatusDetail,
  selectionPosition,
} from "@/lib/racing";
import { formatFinishingPosition, formatPromoTooltip } from "@/lib/bet-outcomes";
import { formatEventTitle, racingVenueLabel } from "@/lib/events";
import {
  earlyPayoutLeadMinute,
  settlementOccurredAt,
} from "@/lib/history-twoup-moment";
import { livePositionValuation } from "@/lib/calc/ep/live-pnl";
import {
  formatLiveMarkets,
  liveModelForEvent,
} from "@/lib/calc/ep/live-model";
import { getHistoryFeed, getChartAnnotationHistory } from "@/lib/services/history-feed";
import { maybeSendDailyTasksDigest } from "@/lib/services/daily-tasks-digest";
import { maybeSendWeeklyDigest } from "@/lib/services/weekly-digest";
import { maybePollEmailIntake } from "@/lib/services/email-intake";
import {
  formatAccaHistoryDetail,
  formatAccaPlacedTitle,
  formatAccaSettlementTitle,
  formatSettlementTitleWithFreeBet,
  historyInPlayPlacementMinute,
} from "@/lib/history-display";
import {
  eventHistoryFacts,
  obsoleteScoreHistoryDedupes,
} from "@/lib/history-event-rows";
import {
  autoResultLinkedLegs,
  legDueState,
  listAccaRuns,
  maybeAccaLayDueAlerts,
  pendingAccaRacingEventIds,
  toAccaDeskStateRun,
} from "@/lib/services/acca-desk";
import {
  autoResultBetBuilderSelections,
  betBuilderLayDue,
  listBetBuilderRuns,
  maybeBetBuilderLayDueAlerts,
  pendingBetBuilderRacingEventIds,
} from "@/lib/services/bet-builder-desk";
import {
  autoResultLinkedSystemLegs,
  listSystemRuns,
  pendingSystemRacingEventIds,
} from "@/lib/services/systems-desk";
import { listInboxDedupes, recordAlerts, unreadCount } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";
import { fireDueUserReminders } from "@/lib/services/user-reminders";
import {
  footballEventPatch,
  isFootballLivePollCandidate,
} from "@/lib/services/feed-sync-rules";
import {
  needsResultBackfill,
  needsTapeBackfill,
  shouldFetchGoalTimeline,
  shouldFetchLineups,
} from "@/lib/live-poll-rules";
import { openBetCoversRacingEvent } from "@/lib/alerts/race-open-bet-coverage";
import { isCasinoInMainFeed } from "@/lib/offers/casino-list-groups";
import { getAppSettings, type AppSettings } from "@/lib/services/settings";
import { backfillOffersFromBets, listOfferSummaries, syncOfferSeriesInstances, syncOfferStatuses } from "@/lib/services/offers";
import { repairMisparsedPlaceFreeBetTriggers } from "@/lib/offers/repair-place-free-bet-triggers";
import { repairInventedPlaceRulesOnUnconditionalOffers } from "@/lib/offers/repair-invented-place-rules";
import { repairMismatchedTitlePlaceRules } from "@/lib/offers/repair-title-place-rules";
import { syncCasinoOfferSeriesInstances } from "@/lib/offers/casino-offer-recurrence";
import type { OfferSummary } from "@/lib/services/offers.types";
import { getRealizedRetention } from "@/lib/services/retention";
import { medianEffortByKind } from "@/lib/offers/effort";
import { formatLivePositionTriggerNote } from "@/lib/services/live-position-note";

export type {
  AppState,
  LiveEventModel,
  LivePosition,
  RacingAutopilotNotice,
  RacingResultsTier,
} from "@/lib/services/state.types";
import type {
  AppState,
  LiveEventModel,
  LivePosition,
  RacingAutopilotNotice,
} from "@/lib/services/state.types";

export {
  toMatchResult,
  toSettleable,
  toTriggerContext,
} from "@/lib/bets/settle-inputs";

const parseRule = parseBetTriggerRule;

/** Advance all running simulations to the current wall clock. */
function tickSimulations(): void {
  const sims = db
    .select()
    .from(events)
    .where(eq(events.source, "sim"))
    .all()
    .filter((e) => e.status !== "finished" && e.simStartedAt);

  for (const sim of sims) {
    const script = JSON.parse(sim.simScript ?? "[]") as SimGoal[];
    const state = simStateAt(script, sim.simStartedAt!);
    db.update(events)
      .set({
        minute: state.minute,
        homeScore: state.homeScore,
        awayScore: state.awayScore,
        homeLed2: state.homeLed2 ? 1 : 0,
        awayLed2: state.awayLed2 ? 1 : 0,
        status: state.finished ? "finished" : state.minute > 0 ? "live" : "upcoming",
        goals: JSON.stringify(state.goals),
      })
      .where(eq(events.id, sim.id))
      .run();
  }
}

/** Refresh imported API events that are tracked (scores poll every ~60s via fixtures cache). */
/** One result-backfill attempt per event per server session. */
const backfillAttempted = new Set<number>();
/** One budget-exhausted alert latch per day per server session. */
let budgetAlertDay = "";

async function refreshApiEvents(): Promise<void> {
  if (!hasApiKey()) return;
  const now = Date.now();

  const allApiRows = db
    .select()
    .from(events)
    .where(eq(events.source, "api"))
    .all();

  const apiEvents = allApiRows.filter((e) => isFootballLivePollCandidate(e, now));

  // Matches that missed their live window (budget ran dry, desk was closed)
  // get one cheap result fetch instead of freezing at the last polled minute.
  const backfillEvents = allApiRows.filter(
    (e) =>
      (needsResultBackfill(e, now) || needsTapeBackfill(e, now)) &&
      !backfillAttempted.has(e.id)
  );
  for (const e of backfillEvents) backfillAttempted.add(e.id);

  if (apiEvents.length === 0 && backfillEvents.length === 0) return;
  apiEvents.push(...backfillEvents);

  try {
    const fixtures = await fixturesByIds(apiEvents.map((e) => e.externalId!));
    for (const event of apiEvents) {
      const fixture = fixtures.find((f) => f.externalId === event.externalId);
      if (!fixture) continue;
      let goals = event.goals;
      let tapeFetchedAt = event.tapeFetchedAt ?? null;
      if (shouldFetchGoalTimeline(event, fixture, now)) {
        try {
          goals = JSON.stringify(await fixtureMatchEvents(event.externalId!, fixture.homeTeam));
          tapeFetchedAt = now;
        } catch {
          // keep the previous timeline; the next poll retries
        }
      }

      let lineups = event.lineups ?? null;
      if (shouldFetchLineups(event, fixture, now)) {
        try {
          const xi = await fixtureLineups(event.externalId!);
          if (xi) lineups = JSON.stringify(xi);
        } catch {
          // keep the previous XI
        }
      }

      db.update(events)
        .set(
          footballEventPatch(event, fixture, goals, {
            lineups,
            tapeFetchedAt,
            now,
          })
        )
        .where(eq(events.id, event.id))
        .run();
    }
  } catch {
    // API hiccups must never break the dashboard; scores just refresh next poll
  }

  // Budget exhaustion mid-match previously died silently (England v Argentina
  // froze at 45' 0-0) - raise a once-a-day alert so it is never a mystery.
  const usage = apiUsageToday();
  const today = new Date().toISOString().slice(0, 10);
  if (usage.used >= usage.budget && budgetAlertDay !== today && apiEvents.length > 0) {
    budgetAlertDay = today;
    const alert = {
      key: `api_budget:${today}`,
      kind: "api_budget",
      title: "Live scores paused",
      body: `Football API budget spent · log goals manually today`,
      href: "/tracked-events",
    };
    recordAlerts([alert]);
    void sendPush(alert).catch(() => {});
  }
}

/** Refresh tracked horse-racing events with results from The Racing API. */
async function refreshRacingApiEvents(): Promise<{ updated: number; settledLabels: string[] }> {
  const deskRacingEventIds = [
    ...pendingAccaRacingEventIds(),
    ...pendingSystemRacingEventIds(),
    ...pendingBetBuilderRacingEventIds(),
  ];
  const r1 = await syncRacingResultsForOpenBets(deskRacingEventIds);
  const r2 = await syncRecentTrackedRacingResults();

  return {
    updated: r1.updated + r2.updated,
    settledLabels: [...r1.settledLabels, ...r2.settledLabels],
  };
}

/**
 * Settle "The bet wins IF" trigger bets in REAL TIME - the moment the outcome is
 * irreversible (e.g. the first goal goes in), not just at full time.
 */
function settleTriggers(): void {
  const openBets = db
    .select()
    .from(bets)
    .where(eq(bets.status, "open"))
    .all()
    .filter((b) => b.eventId && hasBetWinTrigger(b) && b.betType !== "dutch");
  if (openBets.length === 0) return;
  const eventIds = [...new Set(openBets.map((b) => b.eventId!))];
  const byId = new Map(
    db.select().from(events).where(inArray(events.id, eventIds)).all().map((e) => [e.id, e])
  );

  for (const bet of openBets) {
    const event = byId.get(bet.eventId!);
    if (!event || event.status === "upcoming") continue;
    const rule = parseRule(bet);
    if (!rule) continue;
    const verdict = evaluateTrigger(rule, toTriggerContext(event));
    if (verdict.status === "pending") continue;

    const outcome = settleFromOutcome(toSettleable(bet), verdict.status === "won");
    const explanation = `Trigger ${verdict.status}: ${verdict.reason} - ${outcome.explanation}`;
    const settledAt = settlementOccurredAt({
      status: outcome.status,
      now: Date.now(),
      event,
      bet,
    });
    db.update(bets)
      .set({
        status: outcome.status,
        actualProfit: outcome.profit,
        settledAt,
        notes: bet.notes ? `${bet.notes} | ${explanation}` : explanation,
      })
      .where(eq(bets.id, bet.id))
      .run();
    const updated = db.select().from(bets).where(eq(bets.id, bet.id)).get();
    if (updated) ledgerFromSettledBet(updated);
  }
}

/** Auto-settle open bets attached to finished events. */
function autoSettle(): void {
  const openBets = db.select().from(bets).where(eq(bets.status, "open")).all();
  const eventIds = [...new Set(openBets.map((b) => b.eventId).filter((x): x is number => !!x))];
  if (eventIds.length === 0) return;
  const eventRows = db.select().from(events).where(inArray(events.id, eventIds)).all();
  const byId = new Map(eventRows.map((e) => [e.id, e]));

  for (const bet of openBets) {
    if (hasBetWinTrigger(bet)) continue; // bet-win triggers settle via the trigger engine
    // Desk owns Acca / Bet Builder hedges — do not settle them ahead of desk legs.
    if (isAccaDeskLay(bet) || isBetBuilderDeskLay(bet)) continue;
    const event = bet.eventId ? byId.get(bet.eventId) : undefined;
    if (!event || event.status !== "finished") continue;

    let outcome;
    if (event.sport === "horse_racing") {
      const race = parseRaceResults(event.goals);
      if (!race) continue;
      const settleable = toSettleable(bet);
      // Fast result: win markets settle on winner-only; place/EW wait for placings.
      if (!racingMarketReadyToSettle(settleable.market, race)) continue;
      outcome = settleRacingBet(settleable, race);
    } else {
      if (!footballFtResultReady(event)) continue;
      outcome = settleBet(toSettleable(bet), toMatchResult(event));
    }
    if (!outcome) continue; // underivable market → stays open for manual settlement
    let explanation = outcome.explanation;
    if (event.sport === "horse_racing") {
      const race = parseRaceResults(event.goals);
      if (race && bet.selection.trim()) {
        const posLabel = formatFinishingPosition(selectionPosition(bet.selection, race));
        if (posLabel) explanation = `${explanation} · ${posLabel}`;
      }
    }
    const settledAt = settlementOccurredAt({
      status: outcome.status,
      now: Date.now(),
      event,
      bet,
    });
    db.update(bets)
      .set({
        status: outcome.status,
        actualProfit: outcome.profit,
        settledAt,
        notes: bet.notes ? `${bet.notes} | ${explanation}` : explanation,
      })
      .where(eq(bets.id, bet.id))
      .run();
    const updated = db.select().from(bets).where(eq(bets.id, bet.id)).get();
    if (updated) ledgerFromSettledBet(updated);
  }
}

/** Apply AI trigger side-effects (e.g. free bet awards on place finishes). */
function processAiEffects(): void {
  // Settlement awards only from the bet's own trigger/label/triggerText.
  // Offer-title fallback is for early placement credits only - using it here
  // re-awards historical quals (and used to hit free_snr conversions too).
  const candidates = db
    .select()
    .from(bets)
    .all()
    .filter((b) => b.betType !== "free_snr" && b.betType !== "free_sr")
    .filter((b) => freeBetEffectsForBet(b).length > 0);

  if (candidates.length === 0) return;

  const eventIds = [
    ...new Set(candidates.map((b) => b.eventId).filter((id): id is number => id != null)),
  ];
  const byId = new Map(
    (eventIds.length
      ? db.select().from(events).where(inArray(events.id, eventIds)).all()
      : []
    ).map((e) => [e.id, e])
  );

  for (const bet of candidates) {
    for (const effect of freeBetEffectsForBet(bet)) {
      if (effect.kind !== "free_bet_award") continue;

      if (!isPlaceFreeBetEffect(effect)) {
        const verdict = evaluateUnconditionalFreeBet(effect, bet.status);
        if (verdict.met) ledgerPromoAward(bet, effect.amount, verdict.reason);
        continue;
      }

      const event = bet.eventId ? byId.get(bet.eventId) : undefined;
      if (!event || event.status !== "finished" || event.sport !== "horse_racing") continue;

      const race = parseRaceResults(event.goals);
      if (!race || isRaceResultIncomplete(race)) continue;

      const verdict = evaluateFreeBetAward(effect, bet.selection, race);
      if (verdict.met) ledgerPromoAward(bet, effect.amount, verdict.reason);
    }
  }
}

/**
 * Live commentary feed (desk-style): kick-offs, goals with scorers, 2UP
 * triggers, full times, and bet settlements. Entries are written idempotently -
 * every fact has a natural dedupe key - so this can run on every poll.
 */
function syncHistory(allEvents: EventRow[], allBets: BetRow[]): void {
  const now = Date.now();
  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const betsById = new Map(allBets.map((b) => [b.id, b]));
  const accaByBackId = new Map(
    listAccaRuns()
      .filter((b) => b.run.backBetId != null)
      .map((b) => [b.run.backBetId!, b])
  );
  const put = (row: Omit<typeof history.$inferInsert, "createdAt"> & { createdAt?: number }) => {
    db.insert(history)
      .values({ createdAt: now, ...row })
      .onConflictDoNothing()
      .run();
  };
  const upsert = (
    row: Omit<typeof history.$inferInsert, "createdAt"> & { createdAt?: number }
  ) => {
    const existing = db.select().from(history).where(eq(history.dedupe, row.dedupe)).get();
    if (existing) {
      db.update(history)
        .set({
          title: row.title,
          detail: row.detail ?? null,
          amount: row.amount ?? null,
          eventId: row.eventId ?? null,
          betId: row.betId ?? null,
          ...(row.createdAt != null ? { createdAt: row.createdAt } : {}),
          ...(row.minute != null ? { minute: row.minute } : {}),
        })
        .where(eq(history.dedupe, row.dedupe))
        .run();
    } else {
      put(row);
    }
  };

  for (const event of allEvents) {
    const existing =
      event.sport === "football"
        ? db
            .select({ dedupe: history.dedupe })
            .from(history)
            .where(eq(history.eventId, event.id))
            .all()
            .map((row) => row.dedupe)
        : [];
    for (const fact of eventHistoryFacts(event, now, { existingDedupes: existing })) {
      const row = {
        dedupe: fact.dedupe,
        kind: fact.kind,
        eventId: fact.eventId,
        minute: fact.minute,
        title: fact.title,
        detail: fact.detail,
        createdAt: fact.createdAt,
      };
      if (fact.write === "upsert") upsert(row);
      else put(row);
    }
    const staleScoreTicks = obsoleteScoreHistoryDedupes(event);
    if (staleScoreTicks.length > 0) {
      db.delete(history).where(inArray(history.dedupe, staleScoreTicks)).run();
    }
  }

  const promoAwards = getPromoAwardsByBetId();
  const offerTitleById = new Map(
    db
      .select({ id: offers.id, title: offers.title })
      .from(offers)
      .all()
      .map((o) => [o.id, o.title])
  );

  for (const bet of allBets) {
    // Acca / Bet Builder desk lays are campaign hedges. They stay on the desk
    // (+ Profit Tracker) while the run is live — do not narrate them in History.
    if (isAccaDeskLay(bet) || isBetBuilderDeskLay(bet)) {
      db.delete(history).where(eq(history.betId, bet.id)).run();
      continue;
    }

    const linkedEvent = bet.eventId ? eventById.get(bet.eventId) : undefined;
    const accaBundle = isAccaDeskBack(bet) ? accaByBackId.get(bet.id) : undefined;
    const accaDetail = accaBundle
      ? formatAccaHistoryDetail(accaBundle.run, accaBundle.legs)
      : null;
    upsert({
      dedupe: `bet-placed:${bet.id}`,
      kind: "bet_placed",
      betId: bet.id,
      eventId: bet.eventId,
      minute: linkedEvent
        ? historyInPlayPlacementMinute(bet.createdAt, linkedEvent)
        : null,
      title: accaBundle
        ? formatAccaPlacedTitle(bet.betType)
        : isLockInLoggedBet(bet)
          ? "Lock-in placed"
          : bet.betType === "free_snr" || bet.betType === "free_sr"
            ? "Free bet placed"
            : "Bet placed",
      detail: accaDetail ?? bet.label,
      createdAt: bet.createdAt,
    });

    if (bet.status === "open" || !bet.settledAt) continue;
    const promo = promoAwards[bet.id];
    const offerTitle =
      (bet.offerId != null ? offerTitleById.get(bet.offerId) : null) ??
      (accaBundle?.run.offerId != null
        ? offerTitleById.get(accaBundle.run.offerId)
        : null) ??
      accaBundle?.run.label ??
      null;
    const freeBetPhrase = promo ? freeBetAwardPhrase(bet, offerTitle) : null;
    const title = accaBundle
      ? formatAccaSettlementTitle(bet.status, promo, freeBetPhrase ?? undefined)
      : promo && freeBetPhrase && (bet.status === "won" || bet.status === "lost")
        ? formatSettlementTitleWithFreeBet(bet.status, freeBetPhrase)
        : bet.status === "won"
          ? "Bet won"
          : bet.status === "lost"
            ? "Bet lost"
            : bet.status === "early_payout"
              ? "2UP paid early"
              : bet.status === "half_win"
                ? "Bet half won"
                : bet.status === "half_lose"
                  ? "Bet half lost"
                  : bet.status === "push"
                    ? "Bet push"
                    : "Bet void";
    // Acca: campaign second-line (promo already surfaces in the title).
    // Ordinary bets: embed promo in detail when present (subtitle may strip it).
    let detail = accaDetail ?? bet.label;
    if (promo && !accaDetail) {
      detail = `${bet.label} · ${formatPromoTooltip(promo.amount, promo.reason)}`;
    }
    const settlementTime = settlementOccurredAt({
      status: bet.status,
      now: bet.settledAt,
      event: linkedEvent,
      bet,
    });
    const twoUpMinute =
      bet.status === "early_payout" && linkedEvent
        ? earlyPayoutLeadMinute(bet, linkedEvent)
        : null;
    // Acca lays are History-silent: the back row carries the consolidated
    // campaign P&L so History matches the Home chart marker / series step.
    let amount: number | null =
      bet.status === "void" || bet.status === "push" ? null : bet.actualProfit;
    if (
      amount != null &&
      accaBundle?.run.status === "completed"
    ) {
      amount = accaCampaignSettledProfit(accaBundle, betsById) ?? amount;
    }
    upsert({
      dedupe: `bet:${bet.id}:${bet.settledAt}`,
      kind: "settlement",
      betId: bet.id,
      eventId: bet.eventId,
      minute: twoUpMinute,
      title,
      detail,
      amount,
      createdAt: settlementTime,
    });
  }
}

/** "If it ended right now" value of an open trigger bet. */
function triggerProvisional(bet: BetRow, rule: TriggerRule, event: EventRow): number | null {
  const wouldWin = triggerIfEndedNow(rule, toTriggerContext(event));
  if (wouldWin === null) return null;
  return settleFromOutcome(toSettleable(bet), wouldWin).profit;
}

/**
 * Live football + racing result syncs hit external APIs. Running them on every
 * dashboard poll (default 3s) blocks the Node event loop and makes client
 * navigations wait. Local settle/derive still runs every poll.
 */
const EXTERNAL_SYNC_MIN_MS = 20_000;
let lastExternalSyncAt = 0;

export async function getAppState(): Promise<AppState> {
  if (isNeonDesk()) {
    return buildNeonDeskAppState();
  }

  tickSimulations();

  const now = Date.now();
  const runExternalSync = now - lastExternalSyncAt >= EXTERNAL_SYNC_MIN_MS;
  let racingSync: { updated: number; settledLabels: string[] } = {
    updated: 0,
    settledLabels: [],
  };
  let racingResultsTier: RacingResultsTier = hasRacingApiKey()
    ? getCachedRacingResultsTier()
    : ("none" as const);

  if (runExternalSync) {
    lastExternalSyncAt = now;
    await refreshApiEvents();
    racingSync = await refreshRacingApiEvents();
    if (hasRacingApiKey()) {
      racingResultsTier = await resolveRacingResultsTier().catch(() =>
        getCachedRacingResultsTier()
      );
    }
  }

  settleTriggers();
  autoSettle();
  // Fix place-refund triggers stored as unconditional (Course · Horse · offer
  // labels) before settlement side-effects re-credit "Offer unlocked".
  repairMisparsedPlaceFreeBetTriggers();
  // Clear place targets the editor invented on straight bet & get (stops Best
  // plays / favourite-frame copy on unconditional rewards).
  repairInventedPlaceRulesOnUnconditionalOffers();
  // Heal title ↔ rules place mismatches: restore subset corruption from the
  // title, or rewrite a stale OCR title when the user edited places in rules.
  repairMismatchedTitlePlaceRules();
  processAiEffects();
  syncOfferSeriesInstances();
  syncCasinoOfferSeriesInstances();
  syncOfferStatuses();
  backfillOffersFromBets();
  maybeSendWeeklyDigest();
  maybeSendDailyTasksDigest();
  maybePollEmailIntake();
  autoResultLinkedLegs();
  autoResultLinkedSystemLegs();
  autoResultBetBuilderSelections();
  maybeAccaLayDueAlerts();
  maybeBetBuilderLayDueAlerts();
  // User-set "check free spins tomorrow" style reminders → inbox + push.
  fireDueUserReminders(now);

  const allEvents = db.select().from(events).all();
  const allBets = db.select().from(bets).all();
  const eventById = new Map(allEvents.map((e) => [e.id, e]));

  syncHistory(allEvents, allBets);
  // Casino ledger + History/Home feed rows for completed campaigns.
  backfillMissingCasinoOfferBalances();

  const racingAutopilot: RacingAutopilotNotice[] = [];
  let noticeId = Date.now();
  for (const label of racingSync.settledLabels) {
    racingAutopilot.push({ id: noticeId++, message: `Race settled: ${label}` });
  }

  // Acca desk: mid-run lay settlements stay off settled P&L until the run
  // finishes; when square, campaign worst/locked floor lives in provisional.
  // Completed runs fold back + lays into one series step (same-ms final settle
  // otherwise draws a vertical drop/spike on the Home chart).
  const accaBundles = listAccaRuns();
  const deferredAccaLayIds = activeAccaDeskLayBetIds(accaBundles);
  const completedAccaBetIds = completedAccaDeskLinkedBetIds(accaBundles);
  const betsById = new Map(allBets.map((b) => [b.id, b]));

  const settled = allBets
    .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
    .filter((b) => !isDeferredAccaDeskLaySettlement(b, deferredAccaLayIds))
    .filter((b) => !completedAccaBetIds.has(b.id))
    .sort((a, b) => (a.settledAt ?? a.createdAt) - (b.settledAt ?? b.createdAt));

  const allCasinoOffers = db.select().from(casinoOffers).all();
  const casinoSettlements = allCasinoOffers
    .filter((o) => o.status === "completed" && o.actualProfit != null)
    .map((o) => ({
      id: o.id,
      time: o.completedAt ?? o.createdAt,
      amount: o.actualProfit!,
      title: o.title,
      casino: o.casino,
    }))
    .sort((a, b) => a.time - b.time);

  const balanceAdjustments = db
    .select()
    .from(history)
    .where(eq(history.kind, "balance_adjustment"))
    .all();

  const pnlBuckets = computePnlBuckets({
    bets: allBets.filter((b) => !isDeferredAccaDeskLaySettlement(b, deferredAccaLayIds)),
    casinoOffers: allCasinoOffers,
    adjustments: balanceAdjustments,
  });

  type PnlPoint = { time: number; profit: number; commission: number };
  const accaSeriesPoints = completedAccaSeriesPoints(accaBundles, betsById, (id) => {
    const b = betsById.get(id);
    return b ? commissionPaidOnSettledBet(b) : 0;
  });
  const allPnlPoints: PnlPoint[] = [
    ...settled.map((b) => ({
      time: b.settledAt ?? b.createdAt,
      profit: b.actualProfit!,
      commission: commissionPaidOnSettledBet(b),
    })),
    ...accaSeriesPoints.map((p) => ({
      time: p.time,
      profit: p.profit,
      commission: p.commission,
    })),
    ...casinoSettlements.map((c) => ({
      time: c.time,
      profit: c.amount,
      commission: 0,
    })),
    ...balanceAdjustments
      .filter((h) => h.amount != null)
      .map((h) => ({ time: h.createdAt, profit: h.amount!, commission: 0 })),
  ].sort((a, b) => a.time - b.time);

  let running = 0;
  let commissionRunning = 0;
  const series = allPnlPoints.map((p) => {
    running += p.profit;
    commissionRunning += p.commission;
    return { time: p.time, value: running, commissionPaid: commissionRunning };
  });

  const pnlAdjustments = balanceAdjustments
    .filter((h) => h.amount != null && h.amount !== 0)
    .map((h) => ({ id: h.id, time: h.createdAt, amount: h.amount!, detail: h.detail }));

  // Today's tracked races and fixtures with bets (alerts + parked Daily Plan merge).
  const planNow = new Date();
  const planDayStart = new Date(
    planNow.getFullYear(),
    planNow.getMonth(),
    planNow.getDate()
  ).getTime();
  const planDayEnd = planDayStart + 24 * 60 * 60 * 1000;
  const openExpectedFor = (eventId: number) =>
    allBets
      .filter((b) => b.eventId === eventId && b.status === "open" && b.expectedProfit != null)
      .reduce((s, b) => s + (b.expectedProfit ?? 0), 0);

  const offerSummaries = listOfferSummaries();
  const offersById = new Map(offerSummaries.map((o) => [o.id, o]));

  const planRaces = allEvents
    .filter(
      (e) =>
        e.sport === "horse_racing" && e.startTime >= planDayStart && e.startTime < planDayEnd
    )
    .map((e) => ({
      eventId: e.id,
      course: racingVenueLabel(e.competition),
      offTime: e.startTime,
      resultLogged: e.status === "finished" || parseRaceResults(e.goals) != null,
      openExpected: Math.round(openExpectedFor(e.id) * 100) / 100 || null,
      hasOpenBet: allBets.some((b) =>
        openBetCoversRacingEvent(
          b,
          e,
          b.offerId != null ? offersById.get(b.offerId) : undefined
        )
      ),
      externalId: e.externalId ?? null,
    }));

  const planFixtures = allEvents
    .filter(
      (e) =>
        e.sport !== "horse_racing" && e.startTime >= planDayStart && e.startTime < planDayEnd
    )
    .map((e) => {
      const linked = allBets.filter((b) => b.eventId === e.id);
      if (linked.length === 0) return null;
      return {
        eventId: e.id,
        kickoff: e.startTime,
        label: formatEventTitle(e),
        betCount: linked.length,
        openBetCount: linked.filter((b) => b.status === "open").length,
        openExpected: Math.round(openExpectedFor(e.id) * 100) / 100 || null,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f != null);

  const livePositions: LivePosition[] = [];

  for (const bet of allBets.filter((b) => b.status === "open")) {
    const event = bet.eventId ? eventById.get(bet.eventId) : undefined;
    if (!event || event.status !== "live") continue;
    // Acca desk hedges/backs: campaign floor via sumAccaSquareProvisional —
    // never live-value the individual lay (would double-count vs cover ≈ £0).
    if (isAccaDeskLay(bet) || isAccaDeskBack(bet)) continue;
    if (isBetBuilderDeskLay(bet) || isBetBuilderDeskBack(bet)) continue;
    if (isSystemsDeskBack(bet)) continue;

    const rule = parseRule(bet);
    const snapshotProvisional = rule
      ? triggerProvisional(bet, rule, event)
      : provisionalProfit(toSettleable(bet), toMatchResult(event));

    let provisional = snapshotProvisional;
    let valuationMode: LivePosition["valuationMode"] = "snapshot";

    if (!rule && event.sport === "football") {
      const valuation = livePositionValuation(bet, event);
      provisional = valuation.value;
      valuationMode = valuation.mode;
    }

    // Positions tab still shows live snapshot / model EV. Headline Prov does not.
    if (provisional == null) provisional = openBetExpectedProfit(bet);

    const triggerNote = formatLivePositionTriggerNote(
      bet,
      rule,
      toTriggerContext(event)
    );
    const eventStatusLabel =
      event.sport === "horse_racing"
        ? racingEventStatusDetail(event.goals)
        : `${event.homeScore}-${event.awayScore}`;
    livePositions.push({
      betId: bet.id,
      eventId: event.id,
      label: bet.label,
      eventName: event ? formatEventTitle(event) : "-",
      eventSport: event.sport ?? undefined,
      eventStatusLabel,
      minute: event.minute,
      score: eventStatusLabel,
      provisional,
      snapshotProvisional,
      valuationMode,
      expected: bet.expectedProfit,
      triggerNote,
    });
  }

  livePositions.push(
    ...buildDeskLivePositions({
      now,
      eventsById: eventById,
      acca: accaBundles.map(({ run, legs, backBetType }) => ({
        id: run.id,
        label: run.label,
        status: run.status,
        method: run.method,
        offerId: run.offerId,
        noLay: run.noLay,
        stake: run.stake,
        commission: run.commission,
        boostPct: run.boostPct,
        wholeLayStake: run.wholeLayStake,
        wholeLayOdds: run.wholeLayOdds,
        backBetId: run.backBetId,
        backBetType,
        legs: legs.map((leg) => ({
          seq: leg.seq,
          label: leg.label,
          result: leg.result,
          layStake: leg.layStake,
          layOdds: leg.layOdds,
          backOdds: leg.backOdds,
          eventId: leg.eventId,
          scheduledAt: leg.scheduledAt,
        })),
      })),
      betBuilder: listBetBuilderRuns().map(({ run, selections }) => ({
        id: run.id,
        label: run.label,
        status: run.status,
        method: run.method,
        offerId: run.offerId,
        wholeLayStake: run.wholeLayStake,
        backBetId: run.backBetId,
        eventId: run.eventId,
        scheduledAt: run.scheduledAt,
        selectionCount: selections.length,
      })),
      systems: listSystemRuns().map(({ run, legs }) => ({
        id: run.id,
        label: run.label,
        status: run.status,
        offerId: run.offerId,
        backBetId: run.backBetId,
        legs: legs.map((leg) => ({
          seq: leg.seq,
          label: leg.label,
          result: leg.result,
          eventId: leg.eventId,
          scheduledAt: leg.scheduledAt,
        })),
      })),
    })
  );

  const accaDeskIds = allBets
    .filter((b) => isAccaDeskLay(b) || isAccaDeskBack(b))
    .map((b) => b.id);
  const accaSquare = sumAccaSquareProvisional(accaBundles);
  let provisionalTotal =
    sumOpenWorstCaseProfit(allBets, { excludeBetIds: accaDeskIds }) + accaSquare;
  provisionalTotal = Math.round(provisionalTotal * 100) / 100;
  const liveChartProfit = sumLiveChartProvisional(allBets, livePositions, {
    excludeBetIds: accaDeskIds,
    extraProvisional: accaSquare,
  });

  const promoAwards = getPromoAwardsByBetId();
  const { entries: historyRows } = getHistoryFeed({ limit: 40 });
  const chartHistory = getChartAnnotationHistory(allEvents, allBets, promoAwards);

  const liveEventModels: LiveEventModel[] = [];
  for (const event of allEvents) {
    if (event.sport !== "football" || event.status !== "live") continue;
    const model = liveModelForEvent(event);
    if (!model) continue;
    liveEventModels.push({
      eventId: event.id,
      marketsLabel: formatLiveMarkets(model.markets),
      homeWin: model.markets.H,
      draw: model.markets.D,
      awayWin: model.markets.A,
    });
  }

  const settings = getAppSettings();
  const retentionData = getRealizedRetention(undefined, {
    rate: settings.tuning.retentionPrior,
    weight: settings.tuning.retentionPriorWeight,
  });

  const effortMeasured = medianEffortByKind(db.select().from(offerEffortSamples).all());
  const accaLayDue = listAccaRuns().flatMap(({ run, legs }) =>
    legs
      .map((leg) => ({ leg, due: legDueState(run, legs, leg, Date.now()) }))
      .filter(({ due }) => due.due)
      .map(({ leg, due }) => ({
        legId: leg.id,
        runLabel: run.label,
        legLabel: leg.label,
        seq: leg.seq,
        scheduledAt: leg.scheduledAt,
        suggestedStake: due.suggestedStake,
      }))
  );
  const accountNameById = new Map(
    db.select().from(accountsTable).all().map((a) => [a.id, a.name])
  );
  const mugPlanRows = db
    .select()
    .from(mugPlans)
    .all()
    .flatMap((p) => {
      const accountName = accountNameById.get(p.accountId);
      return accountName
        ? [
            {
              id: p.id,
              accountId: p.accountId,
              accountName,
              cadenceDays: p.cadenceDays,
              monthlyBudget: p.monthlyBudget,
              lastMugAt: p.lastMugAt,
            },
          ]
        : [];
    });

  return {
    events: allEvents.sort((a, b) => a.startTime - b.startTime),
    bets: allBets.sort((a, b) => b.createdAt - a.createdAt),
    settledProfit: pnlBuckets.settledProfit,
    bettingProfit: pnlBuckets.bettingProfit,
    casinoProfit: pnlBuckets.casinoProfit,
    provisionalProfit: provisionalTotal,
    liveChartProfit,
    pnlAdjustments,
    casinoSettlements,
    planRaces,
    planFixtures,
    retention: { rate: retentionData.rate, sampleSize: retentionData.sampleSize },
    effortMeasured,
    mugPlans: mugPlanRows,
    accaDesk: accaBundles.map(toAccaDeskStateRun),
    accaLayDue,
    betBuilderLayDue: betBuilderLayDue(),
    alertsUnread: unreadCount(),
    deliveredAlertKeys: listInboxDedupes(),
    boostsOpen: countBoostsNeedingAction(),
    casinoNeedsAction: db
      .select()
      .from(casinoOffers)
      .all()
      .filter((o) => isCasinoInMainFeed(o)).length,
    demoMode: isDemoMode(),
    hostedDesk: false,
    livePositions,
    liveEventModels,
    series,
    history: historyRows,
    chartHistory,
    promoAwards,
    apiConfigured: hasApiKey(),
    racingApiConfigured: hasRacingApiKey(),
    racingResultsTier,
    apiUsage: apiUsageToday(),
    racingApiUsage: racingApiUsageToday(),
    exchangeProvider: getDefaultExchangeProvider(),
    exchangeName: getDefaultExchangeName(),
    exchangeStatus: getExchangeProviderStatus(getDefaultExchangeProvider()),
    exchangeProviders: getAllExchangeProviderStatuses(),
    racingAutopilot,
    settings,
    balances: getBalanceSummary(),
    offers: offerSummaries,
  };
}
