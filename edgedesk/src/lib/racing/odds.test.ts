import { describe, expect, it } from "vitest";
import {
  estimateDecimalsFromRatings,
  formatDecimalOdds,
  fractionalToDecimal,
  formatWeightStones,
  resolveRunnerOdds,
  sortRunnerNamesByOdds,
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

describe("sortRunnerNamesByOdds", () => {
  it("orders favourite-first like Racing Desk (exchange, then bookie, then SP)", () => {
    expect(
      sortRunnerNamesByOdds([
        { name: "Outsider", spDecimal: 21 },
        { name: "Favourite", exchangeDecimal: 2.5 },
        { name: "Second", bookieDecimal: 4 },
        { name: "NR", spDecimal: 3, nonRunner: true },
      ])
    ).toEqual(["Favourite", "Second", "Outsider"]);
  });

  it("keeps unpriced runners in input order", () => {
    expect(
      sortRunnerNamesByOdds([
        { name: "Alpha" },
        { name: "Beta" },
        { name: "Gamma" },
      ])
    ).toEqual(["Alpha", "Beta", "Gamma"]);
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
