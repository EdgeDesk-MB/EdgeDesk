import { describe, expect, it } from "vitest";
import { toMatchResult, toTriggerContext } from "@/lib/bets/settle-inputs";
import type { EventRow } from "@/lib/db/schema";
import {
  footballFtResultReady,
  footballNinetyMinuteGoals,
  footballNinetyMinuteScore,
} from "./football-full-time";

const aet = {
  homeScore: 3,
  awayScore: 2,
  ftHomeScore: 1,
  ftAwayScore: 1,
  matchEnding: "aet" as const,
  status: "finished" as const,
  goals: JSON.stringify([
    { kind: "goal", minute: 12, side: "home" },
    { kind: "goal", minute: 70, side: "away" },
    { kind: "goal", minute: 105, side: "home" },
    { kind: "goal", minute: 118, side: "home" },
  ]),
};

describe("footballNinetyMinuteScore", () => {
  it("uses the stored 90-minute score after extra time", () => {
    expect(footballNinetyMinuteScore(aet)).toEqual({ home: 1, away: 1 });
    expect(footballNinetyMinuteScore({ homeScore: 2, awayScore: 1 })).toEqual({
      home: 2,
      away: 1,
    });
  });
});

describe("footballNinetyMinuteGoals", () => {
  it("drops extra-time goals once the FT scoreline is reached", () => {
    const goals = footballNinetyMinuteGoals(aet);
    expect(goals.map((goal) => goal.minute)).toEqual([12, 70]);
  });
});

describe("footballFtResultReady", () => {
  it("refuses AET or pens until the 90-minute score is stored", () => {
    expect(footballFtResultReady({ ...aet, sport: "football" })).toBe(true);
    expect(
      footballFtResultReady({
        sport: "football",
        status: "finished",
        matchEnding: "aet",
        ftHomeScore: null,
        ftAwayScore: null,
      })
    ).toBe(false);
    expect(
      footballFtResultReady({
        sport: "football",
        status: "finished",
        matchEnding: "ft",
      })
    ).toBe(true);
  });
});

describe("toMatchResult / toTriggerContext", () => {
  it("settles and scores triggers on the 90-minute line, not AET", () => {
    const event = {
      homeTeam: "Chelsea",
      awayTeam: "Leeds",
      status: "finished",
      homeScore: 3,
      awayScore: 2,
      ftHomeScore: 1,
      ftAwayScore: 1,
      homeLed2: 0,
      awayLed2: 0,
      goals: aet.goals,
    } as EventRow;
    expect(toMatchResult(event)).toMatchObject({ homeScore: 1, awayScore: 1 });
    expect(toTriggerContext(event).goals.map((goal) => goal.minute)).toEqual([12, 70]);
  });
});
