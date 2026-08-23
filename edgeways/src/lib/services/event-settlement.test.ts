/**
 * Parity proof for the hosted settlement decision. Each case computes the
 * expected outcome by calling the calc engine directly with the same
 * conversions `services/state.ts` uses, so a divergence between the hosted and
 * local settlement paths fails here.
 */
import { describe, expect, it } from "vitest";
import { settlementForBetOnEvent } from "@/lib/services/event-settlement";
import {
  toMatchResult,
  toSettleable,
  toTriggerContext,
} from "@/lib/bets/settle-inputs";
import {
  evaluateTrigger,
  settleBet,
  settleFromOutcome,
  settleRacingBet,
  type TriggerRule,
} from "@/lib/calc";
import { serializeRaceResults } from "@/lib/racing";
import type { BetRow, EventRow } from "@/lib/db/schema";

const NOW = 1_800_000_000_000;

function event(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    sport: "football",
    externalId: "12345",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    startTime: NOW - 2 * 60 * 60 * 1000,
    status: "finished",
    homeScore: 2,
    awayScore: 1,
    minute: 90,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: null,
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: "ft",
    period: null,
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

describe("settlementForBetOnEvent — football final result", () => {
  it("matches settleBet for a back/lay qualifier that won", () => {
    const b = bet();
    const e = event();
    const expected = settleBet(toSettleable(b), toMatchResult(e))!;

    const actual = settlementForBetOnEvent(b, e)!;
    expect(actual.via).toBe("final_result");
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
    expect(actual.notes).toBe(expected.explanation);
  });

  it("matches settleBet for the same qualifier when the back lost", () => {
    const b = bet();
    const e = event({ homeScore: 0, awayScore: 2 });
    const expected = settleBet(toSettleable(b), toMatchResult(e))!;

    const actual = settlementForBetOnEvent(b, e)!;
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
  });

  it("uses the stored 90-minute score for an AET match, like the local path", () => {
    const b = bet();
    const e = event({
      homeScore: 3,
      awayScore: 2,
      matchEnding: "aet",
      ftHomeScore: 1,
      ftAwayScore: 2,
    });
    const expected = settleBet(toSettleable(b), toMatchResult(e))!;

    const actual = settlementForBetOnEvent(b, e)!;
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
    // 1-2 at 90 minutes: the home back loses despite the 3-2 AET line.
    expect(actual.status).toBe("lost");
  });

  it("pays a 2UP bet early once the home side has led by two", () => {
    const b = bet({ earlyPayout: 1 });
    const e = event({ homeScore: 2, awayScore: 2, homeLed2: 1 });
    const expected = settleBet(toSettleable(b), toMatchResult(e))!;

    const actual = settlementForBetOnEvent(b, e)!;
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
    expect(actual.status).toBe("early_payout");
  });

  it("leaves the bet open while the match is unfinished", () => {
    expect(settlementForBetOnEvent(bet(), event({ status: "live" }))).toBeNull();
    expect(settlementForBetOnEvent(bet(), event({ status: "upcoming" }))).toBeNull();
  });

  it("ignores bets that are not open, or not linked to this event", () => {
    expect(settlementForBetOnEvent(bet({ status: "won" }), event())).toBeNull();
    expect(settlementForBetOnEvent(bet({ eventId: 2 }), event())).toBeNull();
  });
});

describe("settlementForBetOnEvent — trigger bets", () => {
  const rule: TriggerRule = { kind: "btts", yes: true };
  const triggerRule = JSON.stringify(rule);
  const goals = JSON.stringify([
    { minute: 10, side: "home", player: "Saka" },
    { minute: 22, side: "away", player: "Salah" },
  ]);

  it("settles mid-match the moment the trigger is irreversible", () => {
    const b = bet({ triggerRule, triggerText: "Both teams to score" });
    const e = event({ status: "live", minute: 25, homeScore: 1, awayScore: 1, goals });

    const verdict = evaluateTrigger(rule, toTriggerContext(e));
    const expected = settleFromOutcome(toSettleable(b), verdict.status === "won");

    const actual = settlementForBetOnEvent(b, e)!;
    expect(actual.via).toBe("trigger");
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
    expect(actual.notes).toBe(
      `Trigger ${verdict.status}: ${verdict.reason} - ${expected.explanation}`
    );
  });

  it("stays open while the trigger is pending", () => {
    const b = bet({ triggerRule });
    const e = event({ status: "live", minute: 12, homeScore: 1, awayScore: 0 });
    expect(settlementForBetOnEvent(b, e)).toBeNull();
  });

  it("never settles a trigger bet before kick-off", () => {
    const b = bet({ triggerRule });
    expect(settlementForBetOnEvent(b, event({ status: "upcoming" }))).toBeNull();
  });

  it("leaves dutch trigger bets alone, like the local trigger engine", () => {
    const b = bet({ triggerRule, betType: "dutch", legs: "[]" });
    const e = event({ status: "live", homeScore: 1, awayScore: 1, goals });
    expect(settlementForBetOnEvent(b, e)).toBeNull();
  });

  it("appends the explanation to existing notes rather than replacing them", () => {
    const b = bet({ triggerRule, notes: "Placed from the desk" });
    const e = event({ status: "live", homeScore: 1, awayScore: 1, goals });
    expect(settlementForBetOnEvent(b, e)!.notes).toMatch(/^Placed from the desk \| Trigger /);
  });
});

describe("settlementForBetOnEvent — horse racing", () => {
  const fullResult = {
    kind: "horse_racing" as const,
    winner: "Kauto Star",
    fieldSize: 3,
    runners: [
      { horse: "Kauto Star", position: 1 },
      { horse: "Denman", position: 2 },
      { horse: "Neptune Collonges", position: 3 },
    ],
  };

  function race(partial: Partial<EventRow> = {}): EventRow {
    return event({
      sport: "horse_racing",
      competition: "Cheltenham",
      homeTeam: "Cheltenham",
      awayTeam: "",
      goals: serializeRaceResults(fullResult),
      ...partial,
    });
  }

  it("matches settleRacingBet for a winning win-market bet", () => {
    const b = bet({
      market: "win",
      selection: "Kauto Star",
      label: "Kauto Star",
      sport: "horse_racing",
    });
    const e = race();
    const expected = settleRacingBet(toSettleable(b), fullResult)!;

    const actual = settlementForBetOnEvent(b, e)!;
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
    expect(actual.notes).toContain(expected.explanation);
    // Local appends the finishing position to the explanation.
    expect(actual.notes).toContain("Won");
  });

  it("matches settleRacingBet for a losing selection and names the position", () => {
    const b = bet({
      market: "win",
      selection: "Denman",
      label: "Denman",
      sport: "horse_racing",
    });
    const expected = settleRacingBet(toSettleable(b), fullResult)!;

    const actual = settlementForBetOnEvent(b, race())!;
    expect(actual.status).toBe(expected.status);
    expect(actual.profit).toBe(expected.profit);
    expect(actual.notes).toContain("2nd");
  });

  it("waits for placings before settling a place market on a winner-only result", () => {
    const winnerOnly = {
      kind: "horse_racing" as const,
      winner: "Kauto Star",
      fieldSize: 1,
      runners: [{ horse: "Kauto Star", position: 1 }],
    };
    const b = bet({
      market: "place",
      selection: "Denman",
      label: "Denman place",
      sport: "horse_racing",
    });
    expect(
      settlementForBetOnEvent(b, race({ goals: serializeRaceResults(winnerOnly) }))
    ).toBeNull();
  });

  it("stays open when the race has no result yet", () => {
    const b = bet({ market: "win", selection: "Kauto Star", sport: "horse_racing" });
    expect(settlementForBetOnEvent(b, race({ goals: null }))).toBeNull();
  });
});
