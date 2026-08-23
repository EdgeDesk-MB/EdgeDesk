/**
 * Event-derived slices of the hosted Home snapshot (EDGE-81b).
 *
 * Mirrors the event handling in `getAppState()` (services/state.ts) so the
 * hosted desk shows the same live scores, live positions, live model prices and
 * Daily Plan rows as local. Pure over rows: no SQLite, no Neon client.
 *
 * Desk-run positions (Acca / Bet Builder / Systems) are intentionally absent —
 * those tables are SQLite-only, so `buildDeskLivePositions` has nothing to
 * build on the hosted desk.
 */
import { openBetCoversRacingEvent } from "@/lib/alerts/race-open-bet-coverage";
import {
  parseBetTriggerRule,
  toMatchResult,
  toSettleable,
  toTriggerContext,
} from "@/lib/bets/settle-inputs";
import { provisionalProfit, triggerIfEndedNow, settleFromOutcome, type TriggerRule } from "@/lib/calc";
import { formatLiveMarkets, liveModelForEvent } from "@/lib/calc/ep/live-model";
import { livePositionValuation } from "@/lib/calc/ep/live-pnl";
import type { BetRow, EventRow } from "@/lib/db/schema";
import { formatEventTitle, racingVenueLabel } from "@/lib/events";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";
import { parseRaceResults, racingEventStatusDetail } from "@/lib/racing";
import { formatLivePositionTriggerNote } from "@/lib/services/live-position-note";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AppState, LiveEventModel, LivePosition } from "@/lib/services/state.types";

export type HostedEventDerivations = {
  events: EventRow[];
  livePositions: LivePosition[];
  liveEventModels: LiveEventModel[];
  planRaces: AppState["planRaces"];
  planFixtures: AppState["planFixtures"];
};

/** "If it ended right now" value of an open trigger bet (mirrors triggerProvisional). */
function triggerProvisional(
  bet: BetRow,
  rule: TriggerRule,
  event: EventRow
): number | null {
  const wouldWin = triggerIfEndedNow(rule, toTriggerContext(event));
  if (wouldWin === null) return null;
  return settleFromOutcome(toSettleable(bet), wouldWin).profit;
}

export function hostedEventDerivations(
  allEvents: EventRow[],
  allBets: BetRow[],
  offers: OfferSummary[],
  now = Date.now()
): HostedEventDerivations {
  const events = [...allEvents].sort((a, b) => a.startTime - b.startTime);
  const eventById = new Map(events.map((e) => [e.id, e]));

  const livePositions: LivePosition[] = [];
  for (const bet of allBets.filter((b) => b.status === "open")) {
    const event = bet.eventId ? eventById.get(bet.eventId) : undefined;
    if (!event || event.status !== "live") continue;

    const rule = parseBetTriggerRule(bet);
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

    if (provisional == null) provisional = openBetExpectedProfit(bet);

    const eventStatusLabel =
      event.sport === "horse_racing"
        ? racingEventStatusDetail(event.goals)
        : `${event.homeScore}-${event.awayScore}`;
    livePositions.push({
      betId: bet.id,
      eventId: event.id,
      label: bet.label,
      eventName: formatEventTitle(event),
      eventSport: event.sport ?? undefined,
      eventStatusLabel,
      minute: event.minute,
      score: eventStatusLabel,
      provisional,
      snapshotProvisional,
      valuationMode,
      expected: bet.expectedProfit,
      triggerNote: formatLivePositionTriggerNote(bet, rule, toTriggerContext(event)),
    });
  }

  const liveEventModels: LiveEventModel[] = [];
  for (const event of events) {
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

  const planNow = new Date(now);
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
  const offersById = new Map(offers.map((o) => [o.id, o]));

  const planRaces = events
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

  const planFixtures = events
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

  return { events, livePositions, liveEventModels, planRaces, planFixtures };
}
