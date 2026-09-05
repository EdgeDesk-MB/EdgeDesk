/**
 * Hosted Home snapshot now carries the global feed events (EDGE-81b). Before
 * this, `appStateFromNeonDesk` hardcoded `events: []`, so hosted customers saw
 * no live scores and no live positions.
 */
import { describe, expect, it } from "vitest";
import { hostedEventDerivations } from "@/lib/db/neon-desk-state-events";
import { appStateFromNeonDesk } from "@/lib/db/neon-desk-state-map";
import type { BetRow, EventRow } from "@/lib/db/schema";
import { serializeRaceResults } from "@/lib/racing";

const NOW = new Date("2026-08-23T15:00:00Z").getTime();

function event(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    sport: "football",
    externalId: "ext-1",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    startTime: NOW - 40 * 60 * 1000,
    status: "live",
    homeScore: 1,
    awayScore: 0,
    minute: 40,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: null,
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    period: "1H",
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    createdAt: NOW - 3 * 60 * 60 * 1000,
    ...partial,
  };
}

function bet(partial: Partial<BetRow> = {}): BetRow {
  return {
    id: 100,
    eventId: 1,
    label: "Arsenal to win",
    market: "match_odds",
    selection: "home",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 10,
    backOdds: 2.1,
    layStake: 9.9,
    layOdds: 2.12,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: -0.4,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: NOW - 3 * 60 * 60 * 1000,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: "football",
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

describe("appStateFromNeonDesk with global events", () => {
  it("carries hosted events onto the snapshot, kickoff order", () => {
    const state = appStateFromNeonDesk({
      bets: [],
      events: [
        event({ id: 2, startTime: NOW + 60 * 60 * 1000, status: "upcoming" }),
        event({ id: 1, startTime: NOW - 60 * 60 * 1000 }),
      ],
    });
    expect(state.events.map((e) => e.id)).toEqual([1, 2]);
  });

  it("still returns an empty event list when the feed has nothing", () => {
    const state = appStateFromNeonDesk({ bets: [bet()] });
    expect(state.events).toEqual([]);
    expect(state.livePositions).toEqual([]);
  });

  it("builds a live position for an open bet on a live event", () => {
    const state = appStateFromNeonDesk({ bets: [bet()], events: [event()] });
    expect(state.livePositions).toHaveLength(1);
    const position = state.livePositions[0]!;
    expect(position.betId).toBe(100);
    expect(position.eventId).toBe(1);
    expect(position.minute).toBe(40);
    expect(position.score).toBe("1-0");
    expect(position.provisional).not.toBeNull();
  });

  it("publishes live model prices for live football", () => {
    const state = appStateFromNeonDesk({ bets: [], events: [event()] });
    expect(state.liveEventModels).toHaveLength(1);
    const model = state.liveEventModels[0]!;
    expect(model.eventId).toBe(1);
    expect(model.homeWin + model.draw + model.awayWin).toBeCloseTo(1, 2);
  });

  it("leaves live positions empty for bets on a finished event", () => {
    const state = appStateFromNeonDesk({
      bets: [bet()],
      events: [event({ status: "finished", minute: 90 })],
    });
    expect(state.livePositions).toEqual([]);
  });
});

describe("hostedEventDerivations", () => {
  it("lists today's racing in the daily plan with its result state", () => {
    const race = event({
      id: 5,
      sport: "horse_racing",
      externalId: "rac-5",
      competition: "Cheltenham (GB)",
      homeTeam: "Cheltenham",
      awayTeam: "",
      status: "finished",
      startTime: NOW - 30 * 60 * 1000,
      goals: serializeRaceResults({
        winner: "Kauto Star",
        fieldSize: 2,
        runners: [
          { horse: "Kauto Star", position: 1 },
          { horse: "Denman", position: 2 },
        ],
      }),
    });
    const derived = hostedEventDerivations([race], [], [], NOW);
    expect(derived.planRaces).toHaveLength(1);
    expect(derived.planRaces[0]).toMatchObject({
      eventId: 5,
      resultLogged: true,
      externalId: "rac-5",
    });
  });

  it("lists today's fixtures only when a bet is linked", () => {
    const withBet = event({ id: 1 });
    const without = event({ id: 2, externalId: "ext-2" });
    const derived = hostedEventDerivations(
      [withBet, without],
      [bet({ eventId: 1, expectedProfit: 1.5 })],
      [],
      NOW
    );
    expect(derived.planFixtures.map((f) => f.eventId)).toEqual([1]);
    expect(derived.planFixtures[0]).toMatchObject({
      betCount: 1,
      openBetCount: 1,
      openExpected: 1.5,
    });
  });

  it("ignores events outside today", () => {
    const yesterday = event({ id: 9, startTime: NOW - 36 * 60 * 60 * 1000 });
    const derived = hostedEventDerivations([yesterday], [bet({ eventId: 9 })], [], NOW);
    expect(derived.planFixtures).toEqual([]);
    expect(derived.events.map((e) => e.id)).toEqual([9]);
  });
});
