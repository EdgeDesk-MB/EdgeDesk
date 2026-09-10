import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localCalendarDate } from "@/lib/events";
import { twoupScoutKey } from "@/lib/calc/ep/twoup-openness";

vi.mock("@/lib/services/exchange/football-odds", () => ({
  fetchBetfairFootballOdds: vi.fn(),
}));

vi.mock("@/lib/services/exchange/betfair", () => ({
  betfairConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/services/fixture-store", () => ({
  getFixturesForHorizon: vi.fn(),
}));

vi.mock("@/lib/services/settings", () => ({
  getAppSettings: vi.fn(() => ({ favouriteFootballScopes: ["England::Premier League"] })),
}));

async function loadStore() {
  const store = await import("./football-odds-store");
  const odds = await import("@/lib/services/exchange/football-odds");
  const betfair = await import("@/lib/services/exchange/betfair");
  return {
    store,
    fetchBetfairFootballOdds: vi.mocked(odds.fetchBetfairFootballOdds),
    betfairConfigured: vi.mocked(betfair.betfairConfigured),
  };
}

describe("football-odds-store", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { db, footballOddsCache } = await import("@/lib/db");
    db.delete(footballOddsCache).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes through non-empty odds and serves the store", async () => {
    const { store, fetchBetfairFootballOdds } = await loadStore();
    const startTime = Date.now() + 3_600_000;
    const date = localCalendarDate();
    fetchBetfairFootballOdds.mockResolvedValue({
      status: "live",
      odds: { over25Back: 1.4, bttsYesBack: 1.45, homeBack: 1.95, drawBack: 3.4, awayBack: 4.2 },
      missing: [],
    });

    const first = await store.getFootballOddsForFixture({
      home: "Arsenal",
      away: "Chelsea",
      startTime,
      date,
    });
    expect(first?.odds.over25Back).toBe(1.4);
    expect(fetchBetfairFootballOdds).toHaveBeenCalledTimes(1);

    const second = await store.getFootballOddsForFixture({
      home: "Arsenal",
      away: "Chelsea",
      startTime,
      date,
    });
    expect(second?.odds.over25Back).toBe(1.4);
    expect(fetchBetfairFootballOdds).toHaveBeenCalledTimes(1);
    expect(
      await store.readFootballOddsStore(
        twoupScoutKey({ homeTeam: "Arsenal", awayTeam: "Chelsea", startTime })
      )
    ).not.toBeNull();
  });

  it("does not persist empty odds", async () => {
    const { store, fetchBetfairFootballOdds } = await loadStore();
    fetchBetfairFootballOdds.mockResolvedValue({
      status: "unmatched",
      odds: {},
      missing: [],
    });
    const startTime = Date.now() + 3_600_000;
    await expect(
      store.getFootballOddsForFixture({
        home: "Arsenal",
        away: "Chelsea",
        startTime,
        date: localCalendarDate(),
      })
    ).resolves.toBeNull();
    expect(await store.readFootballOddsStoreForDate(localCalendarDate())).toEqual([]);
  });
});
