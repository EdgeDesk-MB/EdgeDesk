import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localCalendarDate } from "@/lib/events";

describe("theracingapi tier access", () => {
  beforeEach(() => {
    vi.stubEnv("RACING_API_USERNAME", "test-user");
    vi.stubEnv("RACING_API_PASSWORD", "test-pass");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("detects tier access errors from RacingApiTierError and legacy messages", async () => {
    const { isRacingTierAccessError, RacingApiTierError } = await import("./theracingapi");

    expect(isRacingTierAccessError(new RacingApiTierError(403, "/v1/racecards/standard"))).toBe(
      true
    );
    expect(
      isRacingTierAccessError(
        new Error("Racing API auth failed - check plan tier for this endpoint")
      )
    ).toBe(true);
    expect(isRacingTierAccessError(new Error("Racing API 500"))).toBe(false);
  });

  it("falls back to null when standard racecards require a higher plan tier", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
      })
    );

    const { racecardsStandard } = await import("./theracingapi");
    await expect(racecardsStandard("today")).resolves.toBeNull();
  });

  it("uses free racecards when standard tier is unavailable", async () => {
    const today = localCalendarDate();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 403,
        ok: false,
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          racecards: [
            {
              race_id: "race-1",
              course: "Ascot",
              race_name: "Free Handicap",
              off_time: "14:30",
              date: today,
              field_size: 1,
              runners: [{ horse_id: "h1", horse: "Demo Runner", number: 1 }],
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { racecardsByDate } = await import("./theracingapi");
    const { cards, oddsTier } = await racecardsByDate(today);

    expect(oddsTier).toBe("free");
    expect(cards).toHaveLength(1);
    expect(cards[0]?.externalId).toBe("race-1");
  });

  it("returns empty map with tierBlocked when results require Basic plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
      })
    );

    const { resultsToday } = await import("./theracingapi");
    const payload = await resultsToday();
    expect(payload.tierBlocked).toBe(true);
    expect(payload.tier).toBe("free");
    expect(payload.results.size).toBe(0);
  });

  it("marks Basic tier when results endpoint succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          results: [
            {
              race_id: "race-win",
              course: "Ascot",
              date: new Date().toISOString().slice(0, 10),
              field_size: 2,
              runners: [
                { horse_id: "h1", horse: "Winner", position: 1 },
                { horse_id: "h2", horse: "Second", position: 2 },
              ],
            },
          ],
        }),
      })
    );

    const { resultsToday, resultsForRaceIds } = await import("./theracingapi");
    const payload = await resultsToday();
    expect(payload.tier).toBe("basic");
    expect(payload.tierBlocked).toBe(false);
    expect(payload.results.get("race-win")?.winner).toBe("Winner");

    const filtered = await resultsForRaceIds(["race-win", "missing"]);
    expect(filtered.tier).toBe("basic");
    expect(filtered.results.size).toBe(1);
  });
});
