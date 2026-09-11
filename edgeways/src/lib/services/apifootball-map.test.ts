import { describe, expect, it } from "vitest";
import {
  mapFixtureScores,
  mapTapeEvent,
  mapTapeEvents,
  tapeLooksShortOfScore,
} from "./apifootball-map";

describe("mapFixtureScores", () => {
  it("lifts a second-half-only goals pair to the published FT/HT total", () => {
    const scores = mapFixtureScores({
      fixture: { status: { short: "FT", elapsed: 90 } },
      goals: { home: 0, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 1, away: 1 },
      },
    });
    expect(scores).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      htHomeScore: 1,
      htAwayScore: 0,
      status: "finished",
      matchEnding: "ft",
    });
  });

  it("does not treat a missing goals.home as 0 when fulltime is published", () => {
    const scores = mapFixtureScores({
      fixture: { status: { short: "FT", elapsed: 90 } },
      goals: { home: null, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 1, away: 1 },
      },
    });
    expect(scores.homeScore).toBe(1);
    expect(scores.awayScore).toBe(1);
  });

  it("keeps a live total at least as high as half-time", () => {
    const scores = mapFixtureScores({
      fixture: { status: { short: "2H", elapsed: 72 } },
      goals: { home: 0, away: 1 },
      score: { halftime: { home: 1, away: 0 } },
    });
    expect(scores.homeScore).toBe(1);
    expect(scores.awayScore).toBe(1);
    expect(scores.status).toBe("live");
  });

  it("uses the cumulative goals figure after extra time", () => {
    const scores = mapFixtureScores({
      fixture: { status: { short: "AET", elapsed: 120 } },
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 1, away: 1 },
        extratime: { home: 1, away: 0 },
      },
    });
    expect(scores.homeScore).toBe(2);
    expect(scores.awayScore).toBe(1);
    expect(scores.ftHomeScore).toBe(1);
    expect(scores.matchEnding).toBe("aet");
  });
});

describe("mapTapeEvent", () => {
  it("sides events by team id when the display name does not match", () => {
    const event = mapTapeEvent(
      {
        type: "Goal",
        detail: "Normal Goal",
        time: { elapsed: 33, extra: null },
        team: { id: 370, name: "Club Bolívar" },
        player: { name: "Ramiro" },
      },
      { homeTeamName: "Bolívar", homeTeamId: 370 }
    );
    expect(event).toMatchObject({ kind: "goal", side: "home", minute: 33, player: "Ramiro" });
  });

  it("keeps VAR comments from the feed", () => {
    const event = mapTapeEvent(
      {
        type: "Var",
        detail: "Goal cancelled",
        comments: "Offside",
        time: { elapsed: 38 },
        team: { id: 1, name: "Home" },
        player: { name: "Ayaosi" },
      },
      { homeTeamName: "Home", homeTeamId: 1 }
    );
    expect(event).toMatchObject({
      kind: "var",
      comments: "Offside",
      detail: "Goal cancelled",
    });
  });
});

describe("tapeLooksShortOfScore", () => {
  it("flags a second-half-only tape against a 1–1 fixture", () => {
    expect(
      tapeLooksShortOfScore(
        mapTapeEvents(
          [
            {
              type: "Goal",
              time: { elapsed: 72 },
              team: { id: 2, name: "Away" },
              player: { name: "Thomaz" },
            },
          ],
          { homeTeamName: "Home", homeTeamId: 1 }
        ),
        1,
        1
      )
    ).toBe(true);
  });

  it("does not flag a VAR cancel as a missing first half", () => {
    expect(
      tapeLooksShortOfScore(
        [
          { kind: "goal", minute: 33, side: "home" },
          { kind: "var", minute: 38, side: "home", detail: "Goal cancelled" },
          { kind: "goal", minute: 72, side: "away" },
        ],
        0,
        1
      )
    ).toBe(false);
  });
});
