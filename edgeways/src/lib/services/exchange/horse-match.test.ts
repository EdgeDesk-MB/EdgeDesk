import { describe, expect, it } from "vitest";
import {
  horseNameMatchScore,
  horseNamesMatch,
  matchHorsesByName,
  normalizeHorseName,
} from "./horse-match";

describe("normalizeHorseName", () => {
  it("strips accents, punctuation and country suffixes", () => {
    expect(normalizeHorseName("O'Brien (IRE)")).toBe("obrien");
    expect(normalizeHorseName("Café Society")).toBe("cafe society");
  });
});

describe("horseNameMatchScore", () => {
  it("scores exact matches highest", () => {
    expect(horseNameMatchScore("Desert Hero", "Desert Hero")).toBe(100);
  });

  it("does not match short substrings", () => {
    expect(horseNamesMatch("I", "Irish Legend")).toBe(false);
    expect(horseNameMatchScore("Al", "Alba Power")).toBe(0);
  });

  it("matches country-suffix variants", () => {
    expect(horseNamesMatch("Desert Hero (IRE)", "Desert Hero")).toBe(true);
  });

  it("assigns unique runners greedily", () => {
    const desk = [
      { horseId: "1", name: "King Of Kings" },
      { horseId: "2", name: "King" },
    ];
    // "King Of Kings" should win over short "King" for the long exchange name
    const map = matchHorsesByName(desk, ["King Of Kings", "Other Horse"]);
    expect(map.get("King Of Kings")?.horseId).toBe("1");
    expect(map.has("Other Horse")).toBe(false);
  });
});
