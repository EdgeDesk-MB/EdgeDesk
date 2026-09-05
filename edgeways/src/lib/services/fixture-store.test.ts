import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localCalendarDate } from "@/lib/events";
import type { Fixture } from "@/lib/services/apifootball";

vi.mock("@/lib/services/apifootball", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/apifootball")>();
  return {
    ...actual,
    hasApiKey: vi.fn(() => true),
    fixturesByDate: vi.fn(),
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

  it("never refetches past dates", async () => {
    const { store, fixturesByDate } = await loadStore();
    const yesterday = localCalendarDate(new Date(Date.now() - 86400000));
    await store.writeFixtureStore(yesterday, [fixture()], Date.now() - 86400000);

    const served = await store.getFixturesForDate(yesterday);
    expect(served.fixtures).toHaveLength(1);
    await flushBackground();
    expect(fixturesByDate).not.toHaveBeenCalled();
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

  it("warmFixtureStore is a no-op without feed credentials", async () => {
    const { store, fixturesByDate, hasApiKey } = await loadStore();
    hasApiKey.mockReturnValue(false);

    const result = await store.warmFixtureStore();
    expect(result).toEqual({ warmed: [], skipped: [] });
    expect(fixturesByDate).not.toHaveBeenCalled();
  });
});
