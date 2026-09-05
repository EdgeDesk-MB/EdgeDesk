import { describe, expect, it } from "vitest";
import {
  formatLineupsCaption,
  lineupPlayerNames,
  parseFootballLineups,
} from "./lineups";

const sample = {
  homeFormation: "4-3-3",
  awayFormation: "4-2-3-1",
  home: [{ name: "Saka", number: 7, grid: "3:1" }],
  away: [{ name: "Salah", number: 11 }],
};

describe("parseFootballLineups", () => {
  it("reads a stored XI", () => {
    expect(parseFootballLineups(JSON.stringify(sample))).toEqual(sample);
  });

  it("returns null for empty or invalid payloads", () => {
    expect(parseFootballLineups(null)).toBeNull();
    expect(parseFootballLineups("{}")).toBeNull();
    expect(parseFootballLineups("nope")).toBeNull();
  });
});

describe("lineup helpers", () => {
  it("lists unique player names home then away", () => {
    expect(lineupPlayerNames(sample)).toEqual(["Saka", "Salah"]);
  });

  it("formats both formations", () => {
    expect(formatLineupsCaption(sample)).toBe("4-3-3 v 4-2-3-1");
    expect(formatLineupsCaption({ ...sample, awayFormation: null })).toBe("4-3-3");
  });
});
