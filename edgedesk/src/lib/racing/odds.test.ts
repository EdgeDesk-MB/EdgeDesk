import { describe, expect, it } from "vitest";
import {
  estimateDecimalsFromRatings,
  formatDecimalOdds,
  fractionalToDecimal,
  formatWeightStones,
  resolveRunnerOdds,
} from "./odds";

describe("fractionalToDecimal", () => {
  it("parses fractional odds", () => {
    expect(fractionalToDecimal("5/1")).toBe(6);
    expect(fractionalToDecimal("Evens")).toBe(2);
  });
});

describe("estimateDecimalsFromRatings", () => {
  it("assigns shorter prices to higher ORF", () => {
    const map = estimateDecimalsFromRatings([
      { horseId: "a", ofr: "80" },
      { horseId: "b", ofr: "60" },
      { horseId: "c", ofr: "55" },
      { horseId: "d", ofr: "50" },
    ]);
    expect(map.get("a")!).toBeLessThan(map.get("b")!);
  });
});

describe("resolveRunnerOdds", () => {
  it("uses proxy when no live price", () => {
    const r = resolveRunnerOdds({ proxyDecimal: 4.5 });
    expect(r.bookieDecimal).toBe(4.5);
    expect(r.source).toBe("proxy");
    expect(r.exchangeDecimal).toBeGreaterThan(4.5);
  });
});

describe("formatDecimalOdds", () => {
  it("formats to 2 decimal places", () => {
    expect(formatDecimalOdds(4.5)).toBe("4.50");
    expect(formatDecimalOdds(2)).toBe("2.00");
    expect(formatDecimalOdds(undefined)).toBe("-");
  });
});

describe("formatWeightStones", () => {
  it("formats lbs as stones-pounds", () => {
    expect(formatWeightStones(135)).toBe("9-9");
  });
});
