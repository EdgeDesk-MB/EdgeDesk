import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localCalendarDate } from "@/lib/events";
import type { Fixture } from "@/lib/services/apifootball";

vi.mock("@/lib/services/apifootball", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/apifootball")>();
  return {
    ...actual,
    hasApiKey: vi.fn(() => true),
    fixturesByDate: vi.fn(),
    liveFixtures: vi.fn(async () => []),
    peekLiveFixtures: vi.fn(() => null),
    peekFootballTape: vi.fn(() => null),
    scheduleLiveFixturesRefresh: vi.fn(),
  };
});

function fixture(partial: Partial<Fixture> = {}): Fixture {
  return {
    externalId: "fix-1",
    sport: "football",
    competition: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startTime: Date.now() + 60 * 60 * 1000,
    status: "upcoming",
    homeScore: 0,
    awayScore: 0,
    minute: 0,
    ...partial,
  };
}

async function flushBackground(predicate?: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  while (predicate && !predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function loadStore() {
  const store = await import("@/lib/services/fixture-store");
  const api = await import("@/lib/services/apifootball");
  return {
    store,
    fixturesByDate: vi.mocked(api.fixturesByDate),
    liveFixtures: vi.mocked(api.liveFixtures),
    peekLiveFixtures: vi.mocked(api.peekLiveFixtures),
    peekFootballTape: vi.mocked(api.peekFootballTape),
    scheduleLiveFixturesRefresh: vi.mocked(api.scheduleLiveFixturesRefresh),
    hasApiKey: vi.mocked(api.hasApiKey),
  };
}

describe("fixture-store", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { db, fixtureCache } = await import("@/lib/db");
    db.delete(fixtureCache).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches live on a cold miss, writes through, then serves the store", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    fixturesByDate.mockResolvedValue([fixture()]);

    const first = await store.getFixturesForDate(today);
    expect(first.fixtures).toHaveLength(1);
    expect(fixturesByDate).toHaveBeenCalledTimes(1);

    const second = await store.getFixturesForDate(today);
    expect(second.fixtures).toHaveLength(1);
    expect(fixturesByDate).toHaveBeenCalledTimes(1);
  });

  it("does not persist an empty upstream payload", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    fixturesByDate.mockResolvedValue([]);

    const first = await store.getFixturesForDate(today);
    expect(first.fixtures).toEqual([]);
    expect(await store.readFixtureStore(today)).toBeNull();
  });

  it("serves a stale payload immediately and refreshes the store behind it", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    const staleAt = Date.now() - store.FIXTURE_STORE_FRESH_MS - 1000;
    await store.writeFixtureStore(today, [fixture({ homeTeam: "Old" })], staleAt);

    fixturesByDate.mockResolvedValue([fixture({ homeTeam: "Fresh" })]);

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]?.homeTeam).toBe("Old");
    expect(served.fetchedAt).toBe(staleAt);

    await flushBackground(() => fixturesByDate.mock.calls.length > 0);
    expect(fixturesByDate).toHaveBeenCalledTimes(1);
    const stored = await store.readFixtureStore(today);
    expect(stored?.fixtures[0]?.homeTeam).toBe("Fresh");
  });

  it("keeps serving the stored payload when the background refresh fails", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(
      today,
      [fixture({ homeTeam: "Old" })],
      Date.now() - store.FIXTURE_STORE_FRESH_MS - 1000
    );
    fixturesByDate.mockRejectedValue(new Error("API-Football 429"));

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]?.homeTeam).toBe("Old");

    await flushBackground(() => fixturesByDate.mock.calls.length > 0);
    expect(fixturesByDate).toHaveBeenCalledTimes(1);
    const stored = await store.readFixtureStore(today);
    expect(stored?.fixtures[0]?.homeTeam).toBe("Old");
  });

  it("refreshes a fresh today row when a live match is past the result window", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(
      today,
      [
        fixture({
          status: "live",
          startTime: Date.now() - store.FOOTBALL_RESULT_CATCH_UP_MS - 1000,
          homeScore: 0,
          awayScore: 0,
          minute: 57,
        }),
      ],
      Date.now()
    );
    fixturesByDate.mockResolvedValue([
      fixture({ status: "finished", homeScore: 1, awayScore: 0, minute: 90 }),
    ]);

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]?.minute).toBe(57);

    await flushBackground(() => fixturesByDate.mock.calls.length > 0);
    expect(fixturesByDate).toHaveBeenCalledWith(today);
    const stored = await store.readFixtureStore(today);
    expect(stored?.fixtures[0]).toMatchObject({
      homeScore: 1,
      awayScore: 0,
      status: "finished",
    });
  });

  it("never refetches a finished past date", async () => {
    const { store, fixturesByDate } = await loadStore();
    const yesterday = localCalendarDate(new Date(Date.now() - 86400000));
    await store.writeFixtureStore(yesterday, [fixture()], Date.now() - 86400000);

    const served = await store.getFixturesForDate(yesterday);
    expect(served.fixtures).toHaveLength(1);
    await flushBackground();
    expect(fixturesByDate).not.toHaveBeenCalled();
  });

  it("serves a frozen overnight live row and writes the FT result behind it", async () => {
    const { store, fixturesByDate } = await loadStore();
    const yesterday = localCalendarDate(new Date(Date.now() - 86400000));
    await store.writeFixtureStore(
      yesterday,
      [
        fixture({
          externalId: "tomayapo-ready",
          homeTeam: "Real Tomayapo",
          awayTeam: "Always Ready",
          status: "live",
          startTime: Date.now() - 12 * 60 * 60 * 1000,
          homeScore: 0,
          awayScore: 0,
          minute: 26,
        }),
      ],
      Date.now() - 12 * 60 * 60 * 1000
    );
    fixturesByDate.mockResolvedValue([
      fixture({
        externalId: "tomayapo-ready",
        homeTeam: "Real Tomayapo",
        awayTeam: "Always Ready",
        status: "finished",
        homeScore: 2,
        awayScore: 0,
        minute: 90,
        matchEnding: "ft",
      }),
    ]);

    const served = await store.getFixturesForDate(yesterday);
    expect(served.fixtures[0]).toMatchObject({
      homeScore: 0,
      awayScore: 0,
      minute: 26,
    });

    await flushBackground(() => fixturesByDate.mock.calls.length > 0);
    expect(fixturesByDate).toHaveBeenCalledWith(yesterday);
    const stored = await store.readFixtureStore(yesterday);
    expect(stored?.fixtures[0]).toMatchObject({
      homeScore: 2,
      awayScore: 0,
      status: "finished",
    });
  });

  it("a today read also writes through a stuck lookback day", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    const threeDaysAgo = localCalendarDate(new Date(Date.now() - 3 * 86400000));
    await store.writeFixtureStore(today, [fixture()]);
    await store.writeFixtureStore(threeDaysAgo, [
      fixture({
        status: "live",
        startTime: Date.now() - 3 * 24 * 60 * 60 * 1000,
        homeScore: 0,
        awayScore: 0,
        minute: 26,
      }),
    ]);
    fixturesByDate.mockImplementation(async (date: string) => {
      if (date === threeDaysAgo) {
        return [fixture({ status: "finished", homeScore: 2, awayScore: 0 })];
      }
      return [fixture()];
    });

    await store.getFixturesForDate(today);
    await flushBackground(() => fixturesByDate.mock.calls.some(([date]) => date === threeDaysAgo));
    const stored = await store.readFixtureStore(threeDaysAgo);
    expect(stored?.fixtures[0]).toMatchObject({
      homeScore: 2,
      awayScore: 0,
      status: "finished",
    });
  });

  it("warmFixtureStore catches a lookback day up when a result is missing", async () => {
    const { store, fixturesByDate } = await loadStore();
    const threeDaysAgo = localCalendarDate(new Date(Date.now() - 3 * 86400000));
    await store.writeFixtureStore(threeDaysAgo, [
      fixture({
        status: "live",
        startTime: Date.now() - 3 * 24 * 60 * 60 * 1000,
        homeScore: 0,
        awayScore: 0,
        minute: 26,
      }),
    ]);
    fixturesByDate.mockResolvedValue([
      fixture({ status: "finished", homeScore: 2, awayScore: 0 }),
    ]);

    const result = await store.warmFixtureStore();
    expect(result.warmed).toContain(threeDaysAgo);
    expect(fixturesByDate).toHaveBeenCalledWith(threeDaysAgo);
  });

  it("re-derives live from kick-off when serving stored fixtures", async () => {
    const { store } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(today, [
      fixture({ status: "upcoming", startTime: Date.now() - 10 * 60 * 1000 }),
    ]);

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]?.status).toBe("live");
  });

  it("overlays a warm live peek without writing it back to the day store", async () => {
    const { store, peekLiveFixtures, liveFixtures } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(today, [
      fixture({
        externalId: "stuttgart-viking",
        status: "live",
        startTime: Date.now() - 10 * 60 * 1000,
        homeScore: 0,
        awayScore: 0,
        minute: 7,
      }),
    ]);
    peekLiveFixtures.mockReturnValue([
      fixture({
        externalId: "stuttgart-viking",
        status: "live",
        homeScore: 2,
        awayScore: 1,
        minute: 28,
      }),
    ]);

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]).toMatchObject({ homeScore: 2, awayScore: 1, minute: 28 });
    expect(liveFixtures).not.toHaveBeenCalled();
    const stored = await store.readFixtureStore(today);
    expect(stored?.fixtures[0]).toMatchObject({ homeScore: 0, awayScore: 0, minute: 7 });
  });

  it("names the last standing goal on a live overlay when the tape matches the score", async () => {
    const { store, peekLiveFixtures, peekFootballTape } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(today, [
      fixture({
        externalId: "bournemouth-brentford",
        status: "live",
        startTime: Date.now() - 69 * 60 * 1000,
        homeScore: 1,
        awayScore: 1,
        minute: 64,
      }),
    ]);
    peekLiveFixtures.mockReturnValue([
      fixture({
        externalId: "bournemouth-brentford",
        status: "live",
        homeScore: 2,
        awayScore: 2,
        minute: 69,
      }),
    ]);
    peekFootballTape.mockReturnValue([
      { kind: "goal", side: "home", minute: 64 },
      { kind: "goal", side: "away", minute: 66 },
      { kind: "goal", side: "home", minute: 69 },
      { kind: "goal", side: "away", minute: 69 },
    ]);

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]).toMatchObject({
      homeScore: 2,
      awayScore: 2,
      lastGoalSide: "away",
      lastGoalMinute: 69,
    });
  });

  it("does not overlay a clock-stale live peek onto a stored FT", async () => {
    const { store, peekLiveFixtures, liveFixtures } = await loadStore();
    const today = localCalendarDate();
    const kickoff = Date.now() - 3 * 60 * 60 * 1000;
    await store.writeFixtureStore(today, [
      fixture({
        externalId: "bolton-cardiff",
        status: "finished",
        startTime: kickoff,
        homeScore: 1,
        awayScore: 0,
        minute: 90,
        period: "FT",
        matchEnding: "ft",
      }),
    ]);
    peekLiveFixtures.mockReturnValue([
      fixture({
        externalId: "bolton-cardiff",
        status: "live",
        startTime: kickoff,
        homeScore: 0,
        awayScore: 0,
        minute: 57,
        period: "2H",
      }),
    ]);

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]).toMatchObject({
      status: "finished",
      homeScore: 1,
      awayScore: 0,
      minute: 90,
    });
    expect(liveFixtures).not.toHaveBeenCalled();
  });

  it("serves the day card when the live poll has not warmed yet", async () => {
    const { store, liveFixtures, peekLiveFixtures, scheduleLiveFixturesRefresh } =
      await loadStore();
    peekLiveFixtures.mockReturnValue(null);
    const today = localCalendarDate();
    await store.writeFixtureStore(today, [
      fixture({
        externalId: "stuttgart-viking",
        status: "live",
        startTime: Date.now() - 10 * 60 * 1000,
        homeScore: 0,
        awayScore: 0,
        minute: 7,
      }),
    ]);
    liveFixtures.mockImplementation(
      () => new Promise(() => {
        /* hang — the day card must not wait */
      })
    );

    const served = await store.getFixturesForDate(today);
    expect(served.fixtures[0]).toMatchObject({ homeScore: 0, awayScore: 0, minute: 7 });
    expect(liveFixtures).not.toHaveBeenCalled();
    expect(scheduleLiveFixturesRefresh).toHaveBeenCalledTimes(1);
  });

  it("throws on a cold miss when the live fetch fails", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    fixturesByDate.mockRejectedValue(new Error("API-Football 500"));

    await expect(store.getFixturesForDate(today)).rejects.toThrow("API-Football 500");
  });

  it("warmFixtureStore warms stale or missing dates and skips fresh ones", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(today, [fixture()]);
    fixturesByDate.mockResolvedValue([fixture()]);

    const result = await store.warmFixtureStore();
    expect(result.skipped).toEqual([today]);
    expect(result.warmed).toHaveLength(1);
    expect(fixturesByDate).toHaveBeenCalledTimes(1);
  });

  it("prunes rows older than the retention window and keeps recent ones", async () => {
    const { store } = await loadStore();
    const old = localCalendarDate(new Date(Date.now() - 10 * 86400000));
    const recent = localCalendarDate(new Date(Date.now() - 3 * 86400000));
    await store.writeFixtureStore(old, [fixture({ homeTeam: "Ancient" })], Date.now() - 10 * 86400000);
    await store.writeFixtureStore(recent, [fixture({ homeTeam: "Recent" })], Date.now() - 3 * 86400000);

    await store.pruneFixtureStore();

    expect(await store.readFixtureStore(old)).toBeNull();
    expect((await store.readFixtureStore(recent))?.fixtures[0]?.homeTeam).toBe("Recent");
  });

  it("getFixturesForHorizon merges today and tomorrow and keeps a live day when the other misses", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    const tomorrow = localCalendarDate(new Date(Date.now() + 86_400_000));
    await store.writeFixtureStore(today, [fixture({ externalId: "today", homeTeam: "Today" })]);
    fixturesByDate.mockImplementation(async (date: string) => {
      if (date === tomorrow) return [fixture({ externalId: "tom", homeTeam: "Tomorrow" })];
      throw new Error("should not refetch today");
    });

    const horizon = await store.getFixturesForHorizon();
    expect(horizon.dates).toEqual([today, tomorrow]);
    expect(horizon.fixtures.map((f) => f.homeTeam).sort()).toEqual(["Today", "Tomorrow"]);
  });

  it("getFixturesForHorizon still serves today when tomorrow's cold fetch fails", async () => {
    const { store, fixturesByDate } = await loadStore();
    const today = localCalendarDate();
    await store.writeFixtureStore(today, [fixture({ homeTeam: "Today" })]);
    fixturesByDate.mockRejectedValue(new Error("API-Football 500"));

    const horizon = await store.getFixturesForHorizon();
    expect(horizon.fixtures[0]?.homeTeam).toBe("Today");
  });

  it("warmFixtureStore is a no-op without feed credentials", async () => {
    const { store, fixturesByDate, hasApiKey } = await loadStore();
    hasApiKey.mockReturnValue(false);

    const result = await store.warmFixtureStore();
    expect(result).toEqual({ warmed: [], skipped: [] });
    expect(fixturesByDate).not.toHaveBeenCalled();
  });
});
