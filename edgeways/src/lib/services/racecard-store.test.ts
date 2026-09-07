import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localCalendarDate } from "@/lib/events";
import type { RacingRacecard } from "@/lib/services/theracingapi";

vi.mock("@/lib/services/theracingapi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/theracingapi")>();
  return {
    ...actual,
    hasRacingApiKey: vi.fn(() => true),
    racecardsByDate: vi.fn(),
    racecardsFree: vi.fn(),
  };
});

function card(partial: Partial<RacingRacecard> = {}): RacingRacecard {
  return {
    externalId: "race-1",
    sport: "horse_racing",
    competition: "Lingfield",
    raceName: "Test Handicap",
    course: "Lingfield",
    startTime: Date.now() + 60 * 60 * 1000,
    status: "upcoming",
    fieldSize: 8,
    offTime: "14:30",
    runners: ["Horse A"],
    runnerDetails: [],
    ...partial,
  };
}

/**
 * Flush the inline background-refresh fallback (after() throws in tests).
 * With a predicate, polls until it holds (or ~2s elapse) so a slow dynamic
 * import of next/server under full-suite load cannot flake the test.
 */
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
  const store = await import("@/lib/services/racecard-store");
  const api = await import("@/lib/services/theracingapi");
  return {
    store,
    racecardsByDate: vi.mocked(api.racecardsByDate),
    racecardsFree: vi.mocked(api.racecardsFree),
    hasRacingApiKey: vi.mocked(api.hasRacingApiKey),
  };
}

describe("racecard-store", () => {
  beforeEach(async () => {
    vi.resetModules();
    // The temp SQLite file is shared across this file's tests.
    const { db, racecardCache } = await import("@/lib/db");
    db.delete(racecardCache).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches live on a cold miss, writes through, then serves the store", async () => {
    const { store, racecardsByDate } = await loadStore();
    const today = localCalendarDate();
    racecardsByDate.mockResolvedValue({ cards: [card()], oddsTier: "standard" });

    const first = await store.getRacecardsForDate(today);
    expect(first.cards).toHaveLength(1);
    expect(first.oddsTier).toBe("standard");
    expect(racecardsByDate).toHaveBeenCalledTimes(1);

    // Fresh stored row: no further upstream fetch.
    const second = await store.getRacecardsForDate(today);
    expect(second.cards).toHaveLength(1);
    expect(racecardsByDate).toHaveBeenCalledTimes(1);
  });

  it("serves a stale payload immediately and refreshes the store behind it", async () => {
    const { store, racecardsByDate } = await loadStore();
    const today = localCalendarDate();
    const staleAt = Date.now() - store.RACECARD_STORE_FRESH_MS - 1000;
    await store.writeRacecardStore(today, [card({ raceName: "Old Card" })], "free", staleAt);

    racecardsByDate.mockResolvedValue({
      cards: [card({ raceName: "Fresh Card" })],
      oddsTier: "standard",
    });

    const served = await store.getRacecardsForDate(today);
    expect(served.cards[0]?.raceName).toBe("Old Card");
    expect(served.fetchedAt).toBe(staleAt);

    await flushBackground(() => racecardsByDate.mock.calls.length > 0);
    expect(racecardsByDate).toHaveBeenCalledTimes(1);
    const stored = await store.readRacecardStore(today);
    expect(stored?.cards[0]?.raceName).toBe("Fresh Card");
    expect(stored?.oddsTier).toBe("standard");
  });

  it("keeps serving the stored payload when the background refresh fails", async () => {
    const { store, racecardsByDate } = await loadStore();
    const today = localCalendarDate();
    await store.writeRacecardStore(
      today,
      [card({ raceName: "Old Card" })],
      "free",
      Date.now() - store.RACECARD_STORE_FRESH_MS - 1000
    );
    racecardsByDate.mockRejectedValue(new Error("Racing API 429"));

    const served = await store.getRacecardsForDate(today);
    expect(served.cards[0]?.raceName).toBe("Old Card");

    await flushBackground(() => racecardsByDate.mock.calls.length > 0);
    expect(racecardsByDate).toHaveBeenCalledTimes(1);
    const stored = await store.readRacecardStore(today);
    expect(stored?.cards[0]?.raceName).toBe("Old Card");
  });

  it("never refetches past dates", async () => {
    const { store, racecardsByDate } = await loadStore();
    const yesterday = localCalendarDate(new Date(Date.now() - 86400000));
    await store.writeRacecardStore(yesterday, [card()], "free", Date.now() - 86400000);

    const served = await store.getRacecardsForDate(yesterday);
    expect(served.cards).toHaveLength(1);
    await flushBackground();
    expect(racecardsByDate).not.toHaveBeenCalled();
  });

  it("re-derives race status from startTime when serving stored cards", async () => {
    const { store } = await loadStore();
    const today = localCalendarDate();
    await store.writeRacecardStore(
      today,
      [card({ status: "upcoming", startTime: Date.now() - 2 * 60 * 60 * 1000 })],
      "free"
    );

    const served = await store.getRacecardsForDate(today);
    expect(served.cards[0]?.status).toBe("finished");
  });

  it("does not persist an empty live payload so a 429 cannot poison the day", async () => {
    const { store, racecardsByDate, racecardsFree } = await loadStore();
    const today = localCalendarDate();
    racecardsByDate.mockResolvedValue({ cards: [], oddsTier: "standard" });
    racecardsFree.mockResolvedValueOnce([]);

    const first = await store.getRacecardsForDate(today);
    expect(first.cards).toHaveLength(0);
    expect(await store.readRacecardStore(today)).toBeNull();

    racecardsByDate.mockResolvedValueOnce({ cards: [card()], oddsTier: "standard" });
    const second = await store.getRacecardsForDate(today);
    expect(second.cards).toHaveLength(1);
    expect(await store.readRacecardStore(today)).not.toBeNull();
  });

  it("throws on a cold miss when the live fetch fails", async () => {
    const { store, racecardsByDate } = await loadStore();
    const today = localCalendarDate();
    racecardsByDate.mockRejectedValue(new Error("Racing API 500"));

    await expect(store.getRacecardsForDate(today)).rejects.toThrow("Racing API 500");
  });

  it("warmRacecardStore warms stale or missing dates and skips fresh ones", async () => {
    const { store, racecardsByDate, racecardsFree } = await loadStore();
    const today = localCalendarDate();
    await store.writeRacecardStore(today, [card()], "standard"); // fresh
    racecardsByDate.mockResolvedValue({ cards: [card()], oddsTier: "standard" });

    const result = await store.warmRacecardStore();
    expect(result.skipped).toEqual([today]);
    expect(result.warmed).toHaveLength(1);
    expect(racecardsByDate).toHaveBeenCalledTimes(1);
    expect(racecardsFree).not.toHaveBeenCalled();
  });

  it("prunes rows older than the retention window and keeps recent ones", async () => {
    const { store } = await loadStore();
    const old = localCalendarDate(new Date(Date.now() - 10 * 86400000));
    const recent = localCalendarDate(new Date(Date.now() - 3 * 86400000));
    await store.writeRacecardStore(old, [card({ raceName: "Ancient" })], "free", Date.now() - 10 * 86400000);
    await store.writeRacecardStore(recent, [card({ raceName: "Recent" })], "free", Date.now() - 3 * 86400000);

    await store.pruneRacecardStore();

    expect(await store.readRacecardStore(old)).toBeNull();
    expect((await store.readRacecardStore(recent))?.cards[0]?.raceName).toBe("Recent");
  });

  it("getRacecardsForHorizon merges today and tomorrow", async () => {
    const { store, racecardsByDate } = await loadStore();
    const today = localCalendarDate();
    const tomorrow = localCalendarDate(new Date(Date.now() + 86_400_000));
    await store.writeRacecardStore(today, [card({ externalId: "today", raceName: "Today" })], "standard");
    racecardsByDate.mockImplementation(async (date: string) => {
      if (date === tomorrow) {
        return { cards: [card({ externalId: "tom", raceName: "Tomorrow" })], oddsTier: "standard" as const };
      }
      throw new Error("should not refetch today");
    });

    const horizon = await store.getRacecardsForHorizon();
    expect(horizon.dates).toEqual([today, tomorrow]);
    expect(horizon.cards.map((c) => c.raceName).sort()).toEqual(["Today", "Tomorrow"]);
  });

  it("warmRacecardStore is a no-op without feed credentials", async () => {
    const { store, racecardsByDate, hasRacingApiKey } = await loadStore();
    hasRacingApiKey.mockReturnValue(false);

    const result = await store.warmRacecardStore();
    expect(result).toEqual({ warmed: [], skipped: [] });
    expect(racecardsByDate).not.toHaveBeenCalled();
  });
});
