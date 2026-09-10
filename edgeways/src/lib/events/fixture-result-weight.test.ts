import { describe, expect, it } from "vitest";
import {
  fixtureTapeNameWeightClass,
  footballFinishedNameWeight,
  matchTapeNameWeightClass,
} from "./fixture-result-weight";

describe("footballFinishedNameWeight", () => {
  it("leaves live and upcoming on the base weight", () => {
    expect(
      footballFinishedNameWeight("home", { status: "live", homeScore: 2, awayScore: 0 })
    ).toBe("base");
    expect(
      footballFinishedNameWeight("away", { status: "upcoming", homeScore: 0, awayScore: 0 })
    ).toBe("base");
  });

  it("steps the winner up and the loser down at full time", () => {
    const ft = { status: "finished" as const, homeScore: 2, awayScore: 1 };
    expect(footballFinishedNameWeight("home", ft)).toBe("bolder");
    expect(footballFinishedNameWeight("away", ft)).toBe("lighter");
    expect(footballFinishedNameWeight("home", { ...ft, homeScore: 0, awayScore: 3 })).toBe(
      "lighter"
    );
    expect(footballFinishedNameWeight("away", { ...ft, homeScore: 0, awayScore: 3 })).toBe(
      "bolder"
    );
  });

  it("keeps both sides on the base weight for a draw", () => {
    const draw = { status: "finished" as const, homeScore: 1, awayScore: 1 };
    expect(footballFinishedNameWeight("home", draw)).toBe("base");
    expect(footballFinishedNameWeight("away", draw)).toBe("base");
  });
});

describe("name weight classes", () => {
  it("moves tape names one step from medium", () => {
    expect(fixtureTapeNameWeightClass("bolder")).toBe("font-semibold");
    expect(fixtureTapeNameWeightClass("lighter")).toBe("font-normal");
    expect(fixtureTapeNameWeightClass("base")).toBe("font-medium");
  });

  it("moves match-header names one step from semibold", () => {
    expect(matchTapeNameWeightClass("bolder")).toBe("font-bold");
    expect(matchTapeNameWeightClass("lighter")).toBe("font-medium");
    expect(matchTapeNameWeightClass("base")).toBe("font-semibold");
  });
});
