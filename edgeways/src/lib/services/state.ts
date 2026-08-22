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
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { isBetBuilderDeskLay } from "@/lib/bets/bet-builder-desk-bets";
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
import { fixtureGoalEvents, fixturesByIds, hasApiKey, apiUsageToday } from "./apifootball";
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
  freeBetAwardPhrase,
  freeBetEffectsForBet,
} from "@/lib/offers/early-free-bet-award";
import {
  betWinRuleForBet,
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
  type DutchLegRecord,
  type GoalEvent,
  type MatchResult,
  type SettleableBet,
  type TriggerContext,
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
import { formatRacingEventTitle } from "@/lib/events";
import { formatEventTitle, racingVenueLabel } from "@/lib/events";
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
} from "@/lib/history-display";
import {
  formatGoalHistoryCopy,
  inferScoringSide,
  previousScorelineFromDedupe,
} from "@/lib/history-goal-copy";
import {
  autoResultLinkedLegs,
  legDueState,
  listAccaRuns,
  maybeAccaLayDueAlerts,
  pendingAccaRacingEventIds,
} from "@/lib/services/acca-desk";
import {
  autoResultBetBuilderSelections,
  betBuilderLayDue,
  maybeBetBuilderLayDueAlerts,
  pendingBetBuilderRacingEventIds,
} from "@/lib/services/bet-builder-desk";
import {
  autoResultLinkedSystemLegs,
  pendingSystemRacingEventIds,
} from "@/lib/services/systems-desk";
import { listInboxDedupes, recordAlerts, unreadCount } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";
import { fireDueUserReminders } from "@/lib/services/user-reminders";
import {
  LIVE_POLL_WINDOW_MS,
  needsResultBackfill,
  shouldFetchGoalTimeline,
} from "@/lib/live-poll-rules";
import { openBetCoversRacingEvent } from "@/lib/alerts/race-open-bet-coverage";
import { isCasinoInMainFeed } from "@/lib/offers/casino-list-groups";
import { getAppSettings, type AppSettings } from "@/lib/services/settings";
import { parseEwMeta } from "@/lib/bets/ew-meta";
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

export function toSettleable(bet: BetRow): SettleableBet {
  return {
    market: bet.market as SettleableBet["market"],
    selection: bet.selection,
    betType: bet.betType as SettleableBet["betType"],
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    earlyPayout: !!bet.earlyPayout,
    refundAmount: bet.refundAmount ?? undefined,
    refundRetention: bet.refundRetention ?? undefined,
    legs: bet.legs ? (JSON.parse(bet.legs) as DutchLegRecord[]) : undefined,
    ewMeta: parseEwMeta(bet.notes) ?? undefined,
  };
}

export function toMatchResult(event: EventRow): MatchResult {
  // Bets settle at 90 minutes (FT). Use the stored 90-min score for AET/PEN matches.
  const usesFtScore =
    (event.matchEnding === "aet" || event.matchEnding === "pen") &&
    event.ftHomeScore != null &&
    event.ftAwayScore != null;
  return {
    homeScore: usesFtScore ? event.ftHomeScore! : event.homeScore,
    awayScore: usesFtScore ? event.ftAwayScore! : event.awayScore,
    homeLed2: !!event.homeLed2,
    awayLed2: !!event.awayLed2,
    inPlay: event.status === "live",
  };
}

export function toTriggerContext(event: EventRow): TriggerContext {
  const usesFtScore =
    (event.matchEnding === "aet" || event.matchEnding === "pen") &&
    event.ftHomeScore != null &&
    event.ftAwayScore != null;
  return {
    homeTeam: event.homeTeam,
    awayTeam: event.awayTeam,
    homeScore: usesFtScore ? event.ftHomeScore! : event.homeScore,
    awayScore: usesFtScore ? event.ftAwayScore! : event.awayScore,
    finished: event.status === "finished",
    goals: event.goals ? (JSON.parse(event.goals) as GoalEvent[]) : [],
  };
}

/** Does this rule need the goal timeline (scorers/order), not just the score? */
function ruleNeedsTimeline(rule: TriggerRule): boolean {
  switch (rule.kind) {
    case "first_goalscorer":
    case "last_goalscorer":
    case "player_scores":
    case "team_scores_first":
      return true;
    case "and":
      return rule.rules.some(ruleNeedsTimeline);
    default:
      return false;
  }
}

function parseRule(bet: BetRow): TriggerRule | null {
  return betWinRuleForBet(bet.triggerRule);
}

function hasBetWinTrigger(bet: BetRow): boolean {
  return parseRule(bet) != null;
}

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

  const apiEvents = allApiRows.filter(
    (e) =>
      (e.sport ?? "football") === "football" &&
      e.externalId &&
      e.status !== "finished" &&
      e.startTime < now + 5 * 60 * 1000 && // kickoff imminent or passed
      e.startTime > now - LIVE_POLL_WINDOW_MS // and not ancient
  );

  // Matches that missed their live window (budget ran dry, desk was closed)
  // get one cheap result fetch instead of freezing at the last polled minute.
  const backfillEvents = allApiRows.filter(
    (e) => needsResultBackfill(e, now) && !backfillAttempted.has(e.id)
  );
  for (const e of backfillEvents) backfillAttempted.add(e.id);

  if (apiEvents.length === 0 && backfillEvents.length === 0) return;
  apiEvents.push(...backfillEvents);

  // Goal timeline is expensive - only fetch for open trigger bets that need scorers.
  const openTriggerBets = db
    .select()
    .from(bets)
    .where(eq(bets.status, "open"))
    .all()
    .filter((b) => b.eventId && b.triggerRule && hasBetWinTrigger(b));
  const needTimeline = new Set(
    openTriggerBets
      .filter((b) => {
        const rule = parseRule(b);
        return rule && ruleNeedsTimeline(rule);
      })
      .map((b) => b.eventId)
  );

  try {
    const fixtures = await fixturesByIds(apiEvents.map((e) => e.externalId!));
    for (const event of apiEvents) {
      const fixture = fixtures.find((f) => f.externalId === event.externalId);
      if (!fixture) continue;
      // 2UP flags must be tracked from score progression: once a side leads by 2, latch it.
      const homeLed2 = event.homeLed2 || (fixture.homeScore - fixture.awayScore >= 2 ? 1 : 0);
      const awayLed2 = event.awayLed2 || (fixture.awayScore - fixture.homeScore >= 2 ? 1 : 0);

      let goals = event.goals;
      // Timeline is a SECOND request per poll - only spend it when the score
      // moved (or a live match has no timeline yet), never every minute.
      if (needTimeline.has(event.id) && shouldFetchGoalTimeline(event, fixture)) {
        try {
          goals = JSON.stringify(await fixtureGoalEvents(event.externalId!, fixture.homeTeam));
        } catch {
          // keep the previous timeline; triggers just wait for the next poll
        }
      }

      db.update(events)
        .set({
          status: fixture.status,
          homeScore: fixture.homeScore,
          awayScore: fixture.awayScore,
          minute: fixture.minute,
          homeLed2,
          awayLed2,
          goals,
          ...(fixture.matchEnding != null
            ? {
                matchEnding: fixture.matchEnding,
                ftHomeScore: fixture.ftHomeScore ?? null,
                ftAwayScore: fixture.ftAwayScore ?? null,
              }
            : {}),
        })
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
    db.update(bets)
      .set({
        status: outcome.status,
        actualProfit: outcome.profit,
        settledAt: Date.now(),
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
    db.update(bets)
      .set({
        status: outcome.status,
        actualProfit: outcome.profit,
        settledAt: Date.now(),
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
        })
        .where(eq(history.dedupe, row.dedupe))
        .run();
    } else {
      put(row);
    }
  };

  for (const event of allEvents) {
    if (event.status === "upcoming") continue;
    if (event.source === "sim") continue;

    if (event.sport === "horse_racing") {
      const race = parseRaceResults(event.goals);
      const title = formatRacingEventTitle(event);
      if (event.status === "finished" && race) {
        upsert({
          dedupe: event.externalId ? `ft:racing:${event.externalId}` : `ft:${event.id}`,
          kind: "full_time",
          eventId: event.id,
          title: "Result",
          detail: `${title} - won by ${race.winner}`,
          createdAt: event.startTime,
        });
      }
      continue;
    }

    const name = `${event.homeTeam} v ${event.awayTeam}`;

    put({
      dedupe: `ko:${event.id}`,
      kind: "kickoff",
      eventId: event.id,
      minute: 0,
      title: "Kick-off",
      detail: name,
      createdAt: event.startTime,
    });

    const goals: GoalEvent[] = event.goals ? JSON.parse(event.goals) : [];
    let h = 0;
    let a = 0;
    goals.forEach((goal, i) => {
      if (goal.side === "home") h++;
      else a++;
      const flags = [
        i === 0 && !goal.og ? "1st goalscorer" : null,
        goal.og ? "own goal" : null,
      ].filter(Boolean);
      const copy = formatGoalHistoryCopy({
        side: goal.side,
        player: goal.player,
        og: goal.og,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
      });
      upsert({
        dedupe: `goal:${event.id}:${i}`,
        kind: "goal",
        eventId: event.id,
        minute: goal.minute,
        title: copy.title,
        detail: `${flags.length ? flags.join(" · ") + " - " : ""}${event.homeTeam} ${h}-${a} ${event.awayTeam}`,
      });
    });
    // API events without a scorer feed: log score changes so the feed never
    // goes quiet just because no player trigger is watching. Name the team
    // when the score ticked by exactly one goal.
    if (goals.length < event.homeScore + event.awayScore && event.homeScore + event.awayScore > 0) {
      const existing = db
        .select({ dedupe: history.dedupe })
        .from(history)
        .where(eq(history.eventId, event.id))
        .all();
      const side = inferScoringSide({
        knownHome: h,
        knownAway: a,
        currentHome: event.homeScore,
        currentAway: event.awayScore,
        previousScore: previousScorelineFromDedupe(
          existing.map((row) => row.dedupe),
          event.id,
          event.homeScore,
          event.awayScore
        ),
      });
      const copy = formatGoalHistoryCopy({
        side,
        homeTeam: event.homeTeam,
        awayTeam: event.awayTeam,
      });
      upsert({
        dedupe: `score:${event.id}:${event.homeScore}-${event.awayScore}`,
        kind: "goal",
        eventId: event.id,
        minute: event.minute,
        title: copy.title,
        detail: `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam}`,
      });
    }

    if (event.homeLed2) {
      put({
        dedupe: `2up:${event.id}:home`,
        kind: "two_up",
        eventId: event.id,
        minute: event.minute,
        title: "2UP triggered",
        detail: `${event.homeTeam} went 2 goals ahead`,
      });
    }
    if (event.awayLed2) {
      put({
        dedupe: `2up:${event.id}:away`,
        kind: "two_up",
        eventId: event.id,
        minute: event.minute,
        title: "2UP triggered",
        detail: `${event.awayTeam} went 2 goals ahead`,
      });
    }

    if (event.status === "finished") {
      const ending = event.matchEnding;
      const titleSuffix = ending === "aet" ? " (AET)" : ending === "pen" ? " (Pens)" : "";
      let scoreDetail: string;
      const hasFtScore = event.ftHomeScore != null && event.ftAwayScore != null;
      if (ending === "aet" && hasFtScore) {
        // Show AET final score; 90-min score in brackets for clarity
        scoreDetail = `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam} (FT: ${event.ftHomeScore}-${event.ftAwayScore})`;
      } else if (ending === "pen" && hasFtScore) {
        scoreDetail = `${event.homeTeam} ${event.ftHomeScore}-${event.ftAwayScore} ${event.awayTeam} (Pens)`;
      } else {
        scoreDetail = `${event.homeTeam} ${event.homeScore}-${event.awayScore} ${event.awayTeam}`;
      }
      upsert({
        dedupe: `ft:${event.id}`,
        kind: "full_time",
        eventId: event.id,
        minute: event.minute || 90,
        title: `Full time${titleSuffix}`,
        detail: scoreDetail,
        createdAt: event.startTime + (event.minute || 90) * 60 * 1000,
      });
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
      title: accaBundle
        ? formatAccaPlacedTitle(bet.betType)
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
    const settlementTime =
      linkedEvent?.sport === "horse_racing" && linkedEvent.startTime
        ? linkedEvent.startTime
        : bet.settledAt;
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
  const allBets = isNeonDesk()
    ? await listNeonDeskBets()
    : db.select().from(bets).all();
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

  // Daily Plan (B1) slot inputs: today's tracked races and fixtures with bets.
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
  let provisionalTotal = 0;
  const liveValuedBetIds = new Set<number>();

  for (const bet of allBets.filter((b) => b.status === "open")) {
    const event = bet.eventId ? eventById.get(bet.eventId) : undefined;
    if (!event || event.status !== "live") continue;
    // Acca desk hedges/backs: campaign floor via sumAccaSquareProvisional —
    // never live-value the individual lay (would double-count vs cover ≈ £0).
    if (isAccaDeskLay(bet) || isAccaDeskBack(bet)) continue;

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

    // Prefer live valuation; fall back to worst-case expected when live can't price it.
    if (provisional == null) provisional = openBetExpectedProfit(bet);

    if (provisional != null) {
      provisionalTotal += provisional;
      liveValuedBetIds.add(bet.id);
    }
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

  // Pre-result open bets: count worst-case guaranteed (e.g. free-bet conversion).
  for (const bet of allBets.filter((b) => b.status === "open")) {
    if (liveValuedBetIds.has(bet.id)) continue;
    // Acca desk backs/lays: campaign provisional is summed below when square.
    if (isAccaDeskLay(bet) || isAccaDeskBack(bet)) continue;
    const expected = openBetExpectedProfit(bet);
    if (expected != null) provisionalTotal += expected;
  }
  provisionalTotal += sumAccaSquareProvisional(accaBundles);
  provisionalTotal = Math.round(provisionalTotal * 100) / 100;

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
    pnlAdjustments,
    casinoSettlements,
    planRaces,
    planFixtures,
    retention: { rate: retentionData.rate, sampleSize: retentionData.sampleSize },
    effortMeasured,
    mugPlans: mugPlanRows,
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
