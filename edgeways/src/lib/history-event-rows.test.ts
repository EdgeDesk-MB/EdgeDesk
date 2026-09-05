import { describe, expect, it } from "vitest";
import {
  eventHistoryFacts,
  obsoleteScoreHistoryDedupes,
  type EventHistorySource,
} from "./history-event-rows";

function event(overrides: Partial<EventHistorySource> = {}): EventHistorySource {
  return {
    id: 9,
    sport: "football",
    source: "api",
    status: "live",
    homeTeam: "Stoke City",
    awayTeam: "Charlton",
    homeScore: 1,
    awayScore: 0,
    homeLed2: 0,
    awayLed2: 0,
    minute: 22,
    goals: null,
    startTime: 1_700_000_000_000,
    externalId: "123",
    matchEnding: null,
    ftHomeScore: null,
    ftAwayScore: null,
    competition: "Championship",
    ...overrides,
  };
}

describe("eventHistoryFacts", () => {
  it("skips upcoming and simulated matches", () => {
    expect(eventHistoryFacts(event({ status: "upcoming" }), 1)).toEqual([]);
    expect(eventHistoryFacts(event({ source: "sim" }), 1)).toEqual([]);
  });

  it("writes kick-off and a tape goal, ignoring cards", () => {
    const facts = eventHistoryFacts(
      event({
        goals: JSON.stringify([
          { kind: "card", minute: 8, side: "away", player: "Foul" },
          { kind: "goal", minute: 11, side: "home", player: "Josh King" },
        ]),
      }),
      1
    );
    const goals = facts.filter((row) => row.kind === "goal");
    expect(facts.some((row) => row.kind === "kickoff")).toBe(true);
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      dedupe: "goal:9:0",
      title: "Goal: Josh King!",
      minute: 11,
    });
    expect(goals[0]!.detail).toContain("1st goalscorer");
    expect(goals[0]!.detail).toContain("Stoke City 1-0 Charlton");
  });

  it("falls back to a score tick when the tape is empty", () => {
    const facts = eventHistoryFacts(event({ goals: "[]", homeScore: 4, awayScore: 0 }), 1);
    const goals = facts.filter((row) => row.kind === "goal");
    expect(goals).toHaveLength(1);
    expect(goals[0]!.dedupe).toBe("score:9:4-0");
    expect(goals[0]!.detail).toBe("Stoke City 4-0 Charlton");
  });

  it("does not add Goal! for a scoreline the tape already named", () => {
    const tape = JSON.stringify([
      { kind: "goal", minute: 11, side: "home", player: "Josh King" },
      { kind: "goal", minute: 35, side: "away", player: "Tyrick Mitchell" },
      { kind: "goal", minute: 42, side: "home", player: "Cesar Palacios Perez" },
    ]);
    const facts = eventHistoryFacts(
      event({
        homeTeam: "Fulham",
        awayTeam: "Crystal Palace",
        homeScore: 2,
        awayScore: 1,
        minute: 43,
        goals: tape,
      }),
      1
    );
    const goals = facts.filter((row) => row.kind === "goal");
    expect(goals.map((row) => row.dedupe)).toEqual(["goal:9:0", "goal:9:1", "goal:9:2"]);
    expect(goals.some((row) => row.title === "Goal!")).toBe(false);
    expect(obsoleteScoreHistoryDedupes({ id: 9, goals: tape })).toEqual([
      "score:9:1-0",
      "score:9:1-1",
      "score:9:2-1",
    ]);
  });

  it("keeps the latest score tick only while the tape is still behind", () => {
    const tape = JSON.stringify([
      { kind: "goal", minute: 11, side: "home", player: "Josh King" },
    ]);
    const facts = eventHistoryFacts(
      event({ homeScore: 2, awayScore: 1, minute: 43, goals: tape }),
      1
    );
    const goals = facts.filter((row) => row.kind === "goal");
    expect(goals.map((row) => row.dedupe)).toEqual(["goal:9:0", "score:9:2-1"]);
    expect(obsoleteScoreHistoryDedupes({ id: 9, goals: tape })).toEqual(["score:9:1-0"]);
  });

  it("uses the clerk-scoped full-time key on the hosted desk", () => {
    const facts = eventHistoryFacts(
      event({ status: "finished", minute: 90, homeScore: 4, awayScore: 0 }),
      1,
      { clerkUserId: "user_1" }
    );
    const ft = facts.find((row) => row.kind === "full_time");
    expect(ft?.dedupe).toBe("ft:9:user_1");
  });
});
