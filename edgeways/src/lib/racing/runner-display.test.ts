import { describe, expect, it } from "vitest";
import {
  formatHeadgear,
  formatHorseColour,
  formatLastRun,
  formatRaceClassLabel,
  formatSex,
  parseJockeyName,
} from "./runner-display";

describe("parseJockeyName", () => {
  it("extracts claim from jockey string", () => {
    expect(parseJockeyName("Shay Farmer(5)")).toEqual({ name: "Shay Farmer", claimLbs: 5 });
    expect(parseJockeyName("P Townend")).toEqual({ name: "P Townend" });
  });
});

describe("formatHeadgear", () => {
  it("expands codes", () => {
    expect(formatHeadgear("B")).toBe("Blinkers");
  });
});

describe("formatHorseColour", () => {
  it("expands bay", () => {
    expect(formatHorseColour("b")).toBe("Bay");
  });
});

describe("formatSex", () => {
  it("expands sex codes", () => {
    expect(formatSex("G")).toBe("Gelding");
    expect(formatSex("f")).toBe("Filly");
  });
});

describe("formatLastRun", () => {
  it("formats days since last run", () => {
    expect(formatLastRun(12)).toBe("12d");
    expect(formatLastRun(0)).toBe("0d");
    expect(formatLastRun(undefined)).toBeUndefined();
  });
});

describe("formatRaceClassLabel", () => {
  it("combines class and rating band", () => {
    expect(formatRaceClassLabel("Class 4", "0-85")).toBe("Class 4 (0-85)");
    expect(formatRaceClassLabel("Class 4", undefined)).toBe("Class 4");
  });
});
