import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RacingRacecard } from "@/lib/services/theracingapi";

const resultsToday = vi.fn(async () => ({
  results: new Map(),
  tierBlocked: false,
  tier: "basic" as const,
}));
const getExchangeOdds = vi.fn(async (..._args: unknown[]) => ({
  provider: "betfair" as const,
  status: "connected" as const,
  feedType: "delayed" as const,
  races: [],
}));
const getRacecardsForDate = vi.fn();

vi.mock("@/lib/services/theracingapi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/theracingapi")>();
  return {
    ...actual,
    hasRacingApiKey: () => true,
    getCachedRacingResultsTier: () => "basic" as const,
    resultsToday: () => resultsToday(),
  };
});

vi.mock("@/lib/services/racecard-store", () => ({
  getRacecardsForDate: (...args: unknown[]) => getRacecardsForDate(...args),
}));

vi.mock("@/lib/services/exchange", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/exchange")>();
  return {
    ...actual,
    resolveLiveExchangeProvider: () => ({
      provider: "betfair" as const,
      name: "Betfair",
      status: {
        provider: "betfair" as const,
        status: "connected" as const,
        feedType: "delayed" as const,
      },
      deskOverride: null,
    }),
    getExchangeOdds: (...args: unknown[]) => getExchangeOdds(...args),
  };
});

function card(): RacingRacecard {
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
    runnerDetails: [
      {
        horseId: "h1",
        name: "Horse A",
        number: "1",
        jockey: "Jockey",
        trainer: "Trainer",
        nonRunner: false,
      },
    ],
  };
}

describe("getRacingDesk lite first paint", () => {
  beforeEach(() => {
    resultsToday.mockClear();
    getExchangeOdds.mockClear();
    getRacecardsForDate.mockReset();
    getRacecardsForDate.mockResolvedValue({
      cards: [card()],
      oddsTier: "free",
      fetchedAt: Date.now(),
    });
  });

  it("skips live results and exchange books so the desk can paint from the store", async () => {
    const { getRacingDesk } = await import("@/lib/services/racing-desk");
    const payload = await getRacingDesk("2026-09-05", { lite: true });

    expect(payload.summary.lite).toBe(true);
    expect(payload.races).toHaveLength(1);
    expect(resultsToday).not.toHaveBeenCalled();
    expect(getExchangeOdds).not.toHaveBeenCalled();
  });

  it("loads results and exchange books on the full request", async () => {
    const { getRacingDesk } = await import("@/lib/services/racing-desk");
    const payload = await getRacingDesk("2026-09-05");

    expect(payload.summary.lite).toBeUndefined();
    expect(resultsToday).toHaveBeenCalledTimes(1);
    expect(getExchangeOdds).toHaveBeenCalledTimes(1);
  });
});
