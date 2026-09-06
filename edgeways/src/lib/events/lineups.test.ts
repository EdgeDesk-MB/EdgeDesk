import { describe, expect, it } from "vitest";
import {
  formatLineupsCaption,
  lineupGridRows,
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

  it("reads coach and bench when stored", () => {
    const withBench = {
      ...sample,
      homeCoach: "Chris Davies",
      homeSubs: [{ name: "Paik Seung-ho", number: 8 }],
    };
    expect(parseFootballLineups(JSON.stringify(withBench))).toMatchObject({
      homeCoach: "Chris Davies",
      homeSubs: [{ name: "Paik Seung-ho", number: 8 }],
    });
  });
});

describe("lineupGridRows", () => {
  it("keeps a single row when there is no grid", () => {
    expect(lineupGridRows(sample.home)).toEqual([sample.home]);
  });

  it("groups and sorts by API-Football grid", () => {
    const xi = [
      { name: "GK", number: 1, grid: "1:1" },
      { name: "RB", number: 2, grid: "2:4" },
      { name: "LB", number: 3, grid: "2:1" },
    ];
    expect(lineupGridRows(xi)).toEqual([
      [{ name: "GK", number: 1, grid: "1:1" }],
      [
        { name: "LB", number: 3, grid: "2:1" },
        { name: "RB", number: 2, grid: "2:4" },
      ],
    ]);
  });
});
