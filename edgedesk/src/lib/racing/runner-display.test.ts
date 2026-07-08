import { describe, expect, it } from "vitest";
import { formatHeadgear, formatHorseColour, parseJockeyName } from "./runner-display";

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
