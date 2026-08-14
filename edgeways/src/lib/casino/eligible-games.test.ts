import { describe, expect, it } from "vitest";
import { parseEligibleGamesJson, serializeEligibleGames } from "./eligible-games";

describe("serializeEligibleGames / parseEligibleGamesJson", () => {
  it("round-trips unique trimmed names", () => {
    const json = serializeEligibleGames([" Starburst ", "Blood Suckers", "starburst"]);
    expect(json).toBe(JSON.stringify(["Starburst", "Blood Suckers"]));
    expect(parseEligibleGamesJson(json)).toEqual(["Starburst", "Blood Suckers"]);
  });

  it("empty or junk → null / []", () => {
    expect(serializeEligibleGames([])).toBeNull();
    expect(serializeEligibleGames(null)).toBeNull();
    expect(parseEligibleGamesJson(null)).toEqual([]);
    expect(parseEligibleGamesJson("not json")).toEqual([]);
    expect(parseEligibleGamesJson("{}")).toEqual([]);
  });
});
