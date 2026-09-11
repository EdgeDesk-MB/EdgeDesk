import { describe, expect, it } from "vitest";
import {
  footballEventPatch,
  isFootballLivePollCandidate,
  racingResultPatch,
  selectFootballSyncEvents,
} from "@/lib/services/feed-sync-rules";
import type { Fixture } from "@/lib/services/apifootball";
import type { EventRow } from "@/lib/db/schema";
import { parseRaceResults, type RaceResult } from "@/lib/racing";

const NOW = 1_800_000_000_000;

function event(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 1,
    sport: "football",
    externalId: "12345",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    startTime: NOW - 30 * 60 * 1000,
    status: "live",
    homeScore: 0,
    awayScore: 0,
    minute: 30,
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
    resultPostedAt: null,
    createdAt: NOW - 60 * 60 * 1000,
    ...partial,
  };
}

function fixture(partial: Partial<Fixture> = {}): Fixture {
  return {
    externalId: "12345",
    sport: "football",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Liverpool",
    startTime: NOW - 30 * 60 * 1000,
    status: "live",
    homeScore: 2,
    awayScore: 0,
    minute: 34,
    period: "1H",
    ...partial,
  };
}

describe("selectFootballSyncEvents", () => {
  it("polls api football events inside the live window", () => {
    const rows = [
      event({ id: 1 }),
      event({ id: 2, sport: "horse_racing" }),
      event({ id: 3, source: "manual" }),
      event({ id: 4, status: "finished" }),
      event({ id: 5, externalId: null }),
      event({ id: 6, startTime: NOW + 60 * 60 * 1000 }),
    ];
    const { poll } = selectFootballSyncEvents(rows, NOW, new Set());
    expect(poll.map((e) => e.id)).toEqual([1]);
  });

  it("gives a stale unfinished match one result backfill, then never again", () => {
    const stale = event({ id: 9, startTime: NOW - 6 * 60 * 60 * 1000 });
    const first = selectFootballSyncEvents([stale], NOW, new Set());
    expect(first.poll).toEqual([]);
    expect(first.backfill.map((e) => e.id)).toEqual([9]);

    const second = selectFootballSyncEvents([stale], NOW, new Set([9]));
    expect(second.backfill).toEqual([]);
  });

  it("gives a finished match with an empty tape one events backfill", () => {
    const finished = event({
      id: 12,
      status: "finished",
      startTime: NOW - 24 * 60 * 60 * 1000,
      goals: null,
    });
    const first = selectFootballSyncEvents([finished], NOW, new Set());
    expect(first.poll).toEqual([]);
    expect(first.backfill.map((e) => e.id)).toEqual([12]);

    const filled = event({
      ...finished,
      goals: '[{"minute":1,"side":"home"}]',
    });
    expect(selectFootballSyncEvents([filled], NOW, new Set()).backfill).toEqual([]);
  });

  it("caps missed-window backfill so one poll cannot walk a weekend", () => {
    const stale = Array.from({ length: 8 }, (_, i) =>
      event({
        id: 20 + i,
        externalId: String(200 + i),
        status: "finished",
        startTime: NOW - 24 * 60 * 60 * 1000,
        goals: null,
      })
    );
    const { backfill } = selectFootballSyncEvents(stale, NOW, new Set());
    expect(backfill).toHaveLength(3);
    expect(backfill.map((e) => e.id)).toEqual([20, 21, 22]);
  });

  it("never lists an event as both a poll and a backfill", () => {
    const live = event({ id: 1 });
    const { poll, backfill } = selectFootballSyncEvents([live], NOW, new Set());
    expect(poll).toHaveLength(1);
    expect(backfill).toHaveLength(0);
  });

  it("agrees with the single-event predicate", () => {
    expect(isFootballLivePollCandidate(event(), NOW)).toBe(true);
    expect(isFootballLivePollCandidate(event({ status: "finished" }), NOW)).toBe(false);
    expect(
      isFootballLivePollCandidate(
        event({ status: "finished", matchEnding: "ft", resultPostedAt: NOW - 60_000 }),
        NOW
      )
    ).toBe(true);
  });
});

describe("footballEventPatch", () => {
  it("writes the score, minute, period and status from the fixture", () => {
    const patch = footballEventPatch(event(), fixture(), null);
    expect(patch).toMatchObject({
      status: "live",
      homeScore: 2,
      awayScore: 0,
      minute: 34,
      period: "1H",
      goals: null,
    });
  });

  it("persists the half-time score when the fixture has one", () => {
    const patch = footballEventPatch(
      event(),
      fixture({ htHomeScore: 1, htAwayScore: 0 }),
      null
    );
    expect(patch.htHomeScore).toBe(1);
    expect(patch.htAwayScore).toBe(0);
  });

  it("latches homeLed2 once the home side leads by two", () => {
    const patch = footballEventPatch(event(), fixture({ homeScore: 2, awayScore: 0 }), null);
    expect(patch.homeLed2).toBe(1);
    expect(patch.awayLed2).toBe(0);
  });

  it("keeps a latched 2UP flag after the lead is pegged back", () => {
    const patch = footballEventPatch(
      event({ homeLed2: 1 }),
      fixture({ homeScore: 2, awayScore: 2 }),
      null
    );
    expect(patch.homeLed2).toBe(1);
  });

  it("latches awayLed2 for a two-goal away lead", () => {
    const patch = footballEventPatch(event(), fixture({ homeScore: 0, awayScore: 3 }), null);
    expect(patch.awayLed2).toBe(1);
    expect(patch.homeLed2).toBe(0);
  });

  it("stores the 90-minute score only when the match went to AET or pens", () => {
    const aet = footballEventPatch(
      event(),
      fixture({
        status: "finished",
        homeScore: 3,
        awayScore: 2,
        matchEnding: "aet",
        ftHomeScore: 2,
        ftAwayScore: 2,
      }),
      null
    );
    expect(aet).toMatchObject({ matchEnding: "aet", ftHomeScore: 2, ftAwayScore: 2 });

    const live = footballEventPatch(event(), fixture({ matchEnding: null }), null);
    expect(live).not.toHaveProperty("matchEnding");
  });

  it("carries the timeline the caller decided to fetch", () => {
    const goals = JSON.stringify([{ minute: 12, side: "home", player: "Saka" }]);
    expect(footballEventPatch(event(), fixture(), goals).goals).toBe(goals);
  });

  it("stamps the API finish on the first FT poll and reopens for extra time", () => {
    const now = NOW;
    const finished = footballEventPatch(
      event(),
      fixture({ status: "finished", matchEnding: "ft", minute: 20, period: undefined }),
      JSON.stringify([{ kind: "goal", minute: 12, side: "home" }]),
      { now }
    );
    expect(finished.status).toBe("finished");
    expect(finished.resultPostedAt).toBe(now);

    const extra = footballEventPatch(
      event({
        status: "finished",
        matchEnding: "ft",
        resultPostedAt: now,
        homeScore: 1,
        awayScore: 1,
      }),
      fixture({ status: "live", period: "ET", minute: 91, matchEnding: null }),
      null,
      { now: now + 60_000 }
    );
    expect(extra.status).toBe("live");
    expect(extra.resultPostedAt).toBeNull();
    expect(extra.matchEnding).toBeNull();
    expect(extra.ftHomeScore).toBe(1);
    expect(extra.ftAwayScore).toBe(1);
    expect(extra.homeLed2).toBe(0);
  });

  it("does not latch 2UP from an extra-time scoreline", () => {
    const patch = footballEventPatch(
      event({ homeLed2: 0, awayLed2: 0, ftHomeScore: 1, ftAwayScore: 1 }),
      fixture({
        status: "live",
        period: "ET",
        homeScore: 3,
        awayScore: 1,
        minute: 105,
        matchEnding: null,
      }),
      null
    );
    expect(patch.homeLed2).toBe(0);
  });
});

function raceResult(partial: Partial<RaceResult> = {}): RaceResult {
  return {
    kind: "horse_racing",
    winner: "Kauto Star",
    fieldSize: 3,
    runners: [
      { horse: "Kauto Star", position: 1 },
      { horse: "Denman", position: 2 },
      { horse: "Neptune", position: 3 },
    ],
    ...partial,
  };
}

describe("racingResultPatch", () => {
  it("finishes the event and serialises the placings", () => {
    const patch = racingResultPatch(event({ sport: "horse_racing", goals: null }), raceResult());
    expect(patch).not.toBeNull();
    expect(patch!.status).toBe("finished");
    expect(patch!.homeScore).toBe(1);
    expect(patch!.awayScore).toBe(0);
    const parsed = parseRaceResults(patch!.goals ?? null);
    expect(parsed?.winner).toBe("Kauto Star");
    expect(parsed?.runners.map((r) => r.horse)).toEqual([
      "Kauto Star",
      "Denman",
      "Neptune",
    ]);
  });

  it("refuses to downgrade a full result to a winner-only payload", () => {
    const stored = racingResultPatch(
      event({ sport: "horse_racing", goals: null }),
      raceResult()
    );
    const thin = raceResult({
      runners: [{ horse: "Kauto Star", position: 1 }],
      fieldSize: 1,
    });
    expect(
      racingResultPatch({ goals: stored!.goals ?? null }, thin)
    ).toBeNull();
  });

  it("overwrites when forced", () => {
    const stored = racingResultPatch(
      event({ sport: "horse_racing", goals: null }),
      raceResult()
    );
    const thin = raceResult({
      winner: "Denman",
      runners: [{ horse: "Denman", position: 1 }],
      fieldSize: 1,
    });
    const forced = racingResultPatch({ goals: stored!.goals ?? null }, thin, true);
    expect(parseRaceResults(forced!.goals ?? null)?.winner).toBe("Denman");
  });

  it("preserves racecard display meta already on the event", () => {
    const withMeta = racingResultPatch(
      {
        goals: JSON.stringify({
          kind: "horse_racing",
          winner: "",
          runners: [],
          fieldSize: 0,
          going: "Good to soft",
          distance: "2m4f",
        }),
      },
      raceResult()
    );
    const parsed = parseRaceResults(withMeta!.goals ?? null);
    expect(parsed?.going).toBe("Good to soft");
    expect(parsed?.distance).toBe("2m4f");
  });
});
