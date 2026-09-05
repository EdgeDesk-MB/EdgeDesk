import { describe, expect, it } from "vitest";
import {
  shouldFetchGoalTimeline,
  shouldFetchLineups,
  needsResultBackfill,
  LIVE_POLL_WINDOW_MS,
  RESULT_BACKFILL_MAX_AGE_MS,
  TAPE_REFRESH_MS,
} from "./live-poll-rules";

const NOW = new Date(2026, 6, 16, 12, 0, 0).getTime();

describe("shouldFetchGoalTimeline", () => {
  const event = { goals: '[{"minute":10,"side":"home"}]', homeScore: 1, awayScore: 0 };

  it("fetches when the fixture score moved past the stored score", () => {
    expect(
      shouldFetchGoalTimeline(event, { status: "live", homeScore: 1, awayScore: 1 })
    ).toBe(true);
  });

  it("skips when nothing changed and the tape is still fresh", () => {
    expect(
      shouldFetchGoalTimeline(
        { ...event, tapeFetchedAt: NOW },
        { status: "live", homeScore: 1, awayScore: 0 },
        NOW
      )
    ).toBe(false);
  });

  it("refetches a live tape after five minutes so cards land without a goal", () => {
    expect(
      shouldFetchGoalTimeline(
        { ...event, tapeFetchedAt: NOW - TAPE_REFRESH_MS },
        { status: "live", homeScore: 1, awayScore: 0 },
        NOW
      )
    ).toBe(true);
  });

  it("fetches when the period flips (HT / FT) even if the score is unchanged", () => {
    expect(
      shouldFetchGoalTimeline(
        { ...event, period: "1H", tapeFetchedAt: NOW },
        { status: "live", homeScore: 1, awayScore: 0, period: "HT" },
        NOW
      )
    ).toBe(true);
  });

  it("fetches once when live with no stored timeline (catch-up after restart)", () => {
    expect(
      shouldFetchGoalTimeline(
        { goals: null, homeScore: 1, awayScore: 0 },
        { status: "live", homeScore: 1, awayScore: 0 }
      )
    ).toBe(true);
  });

  it("never fetches for an upcoming fixture", () => {
    expect(
      shouldFetchGoalTimeline(event, { status: "upcoming", homeScore: 0, awayScore: 0 })
    ).toBe(false);
  });
});

describe("shouldFetchLineups", () => {
  it("skips when an XI is already stored", () => {
    expect(
      shouldFetchLineups(
        { lineups: '{"home":[{"name":"Saka"}],"away":[]}', startTime: NOW + 60_000 },
        { status: "upcoming" },
        NOW
      )
    ).toBe(false);
  });

  it("fetches once kick-off is inside two hours", () => {
    expect(
      shouldFetchLineups(
        { lineups: null, startTime: NOW + 90 * 60 * 1000 },
        { status: "upcoming" },
        NOW
      )
    ).toBe(true);
  });

  it("waits when kick-off is still far away", () => {
    expect(
      shouldFetchLineups(
        { lineups: null, startTime: NOW + 5 * 60 * 60 * 1000 },
        { status: "upcoming" },
        NOW
      )
    ).toBe(false);
  });
});

describe("needsResultBackfill", () => {
  const base = {
    sport: "football",
    source: "api",
    externalId: "123",
    status: "live",
  };

  it("selects an unfinished api match that fell out of the live window", () => {
    expect(
      needsResultBackfill({ ...base, startTime: NOW - LIVE_POLL_WINDOW_MS - 60_000 }, NOW)
    ).toBe(true);
  });

  it("leaves matches still inside the live window to normal polling", () => {
    expect(needsResultBackfill({ ...base, startTime: NOW - 60 * 60 * 1000 }, NOW)).toBe(false);
  });

  it("gives up on ancient matches", () => {
    expect(
      needsResultBackfill({ ...base, startTime: NOW - RESULT_BACKFILL_MAX_AGE_MS - 1 }, NOW)
    ).toBe(false);
  });

  it("ignores finished matches, other sports and manual events", () => {
    const stale = NOW - LIVE_POLL_WINDOW_MS - 60_000;
    expect(needsResultBackfill({ ...base, status: "finished", startTime: stale }, NOW)).toBe(false);
    expect(needsResultBackfill({ ...base, sport: "horse_racing", startTime: stale }, NOW)).toBe(false);
    expect(needsResultBackfill({ ...base, source: "manual", startTime: stale }, NOW)).toBe(false);
    expect(needsResultBackfill({ ...base, externalId: null, startTime: stale }, NOW)).toBe(false);
  });
});
