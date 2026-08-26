import { describe, expect, it } from "vitest";
import {
  accaRacingDeskBet,
  deskRunnerMarksForEvent,
  isRacingDeskHiddenBet,
} from "./desk-active-bets";
import type { RacingDeskAcca, RacingDeskEventRef } from "./desk-active-bets";

const york: RacingDeskEventRef = {
  id: 1,
  sport: "horse_racing",
  competition: "York",
  startTime: Date.parse("2026-08-22T15:10:00Z"),
  externalId: "york-1610",
};

function yorkDouble(over: Partial<RacingDeskAcca> = {}): RacingDeskAcca {
  return {
    id: 7,
    label: "Bet £10 get £10 free bet",
    status: "active",
    method: "sequential",
    offerId: 42,
    stake: 10,
    commission: 0,
    wholeLayStake: null,
    wholeLayOdds: null,
    backBetId: 88,
    backBetType: "qualifying",
    bookmaker: "Betfair Sportsbook",
    backStake: 10,
    backOdds: 11.375,
    legs: [
      {
        seq: 1,
        label: "Notable Speech",
        selection: "Notable Speech",
        result: "pending",
        layStake: 10,
        layOdds: 3.7,
        backOdds: 3.5,
        eventId: 1,
      },
      {
        seq: 2,
        label: "Dance In The Storm",
        selection: "Dance In The Storm",
        result: "pending",
        layStake: null,
        layOdds: null,
        backOdds: 3.25,
        eventId: 2,
      },
    ],
    ...over,
  };
}

describe("isRacingDeskHiddenBet", () => {
  it("hides acca desk lays so they do not render as £0.00 @ 0", () => {
    expect(
      isRacingDeskHiddenBet({
        label: "Acca lay · Notable Speech",
        notes: 'Acca desk: leg 1 of "Weekend"',
        betType: "lay_only",
      })
    ).toBe(true);
  });
});

describe("accaRacingDeskBet", () => {
  it("emits one campaign card with the bookie stake and combined price", () => {
    const events = new Map<number, RacingDeskEventRef>([
      [1, york],
      [2, { ...york, id: 2, externalId: "york-1620" }],
    ]);
    const row = accaRacingDeskBet(yorkDouble(), events);
    expect(row?.kind).toBe("acca");
    expect(row?.href).toBe("/acca");
    expect(row?.selection).toBe("Notable Speech");
    expect(row?.bookmaker).toBe("Betfair Sportsbook");
    expect(row?.backStake).toBe(10);
    expect(row?.backOdds).toBe(11.375);
    expect(row?.progressCaption).toBe("1/2 laid");
    expect(row?.triggerNote).toBeNull();
    expect(row?.expectedProfit).toBeCloseTo(0, 10);
  });

  it("skips a football-only acca", () => {
    const events = new Map<number, RacingDeskEventRef>([
      [9, { id: 9, sport: "football", competition: "EPL" }],
    ]);
    expect(
      accaRacingDeskBet(
        yorkDouble({
          legs: [
            {
              seq: 1,
              label: "Arsenal",
              selection: "Arsenal",
              result: "pending",
              layStake: null,
              layOdds: null,
              backOdds: 2,
              eventId: 9,
            },
          ],
        }),
        events
      )
    ).toBeNull();
  });
});

describe("deskRunnerMarksForEvent", () => {
  it("marks both laid and unlaid acca horses on their races", () => {
    const run = yorkDouble();
    expect(deskRunnerMarksForEvent(1, { acca: [run] })).toEqual([
      { selection: "Notable Speech", status: "open" },
    ]);
    expect(deskRunnerMarksForEvent(2, { acca: [run] })).toEqual([
      { selection: "Dance In The Storm", status: "open" },
    ]);
  });
});
