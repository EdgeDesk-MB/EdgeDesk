import { describe, expect, it } from "vitest";
import {
  estimateDecimalsFromRatings,
  formatDecimalOdds,
  formatSpOddsDisplay,
  fractionalToDecimal,
  formatWeightStones,
  resolveRunnerOdds,
  sortRunnerNamesByOdds,
  splitSpLabel,
  spLabelMarksFavourite,
} from "./odds";

describe("fractionalToDecimal", () => {
  it("parses fractional odds", () => {
    expect(fractionalToDecimal("5/1")).toBe(6);
    expect(fractionalToDecimal("Evens")).toBe(2);
  });

  it("strips Racing API joint-fav suffixes before converting", () => {
    // 100/30 = 3.333…/1 → decimal 4.333…
    expect(fractionalToDecimal("100/30J")).toBeCloseTo(1 + 100 / 30, 5);
    expect(fractionalToDecimal("100/30 J")).toBeCloseTo(1 + 100 / 30, 5);
    expect(fractionalToDecimal("5/2F")).toBe(3.5);
  });

  it("does not parseFloat a broken fraction as the numerator alone", () => {
    expect(fractionalToDecimal("100/30x")).toBeUndefined();
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

describe("splitSpLabel / formatSpOddsDisplay", () => {
  it("splits Fav / F / JFav without eating the price", () => {
    expect(splitSpLabel("6/4 Fav")).toEqual({ oddsPart: "6/4", marker: "Fav" });
    expect(splitSpLabel("11/4 F")).toEqual({ oddsPart: "11/4", marker: "F" });
    expect(splitSpLabel("5/2 JFav")).toEqual({ oddsPart: "5/2", marker: "JFav" });
    expect(splitSpLabel("9/2")).toEqual({ oddsPart: "9/2", marker: null });
  });

  it("splits Racing API glued joint-fav suffixes", () => {
    expect(splitSpLabel("100/30J")).toEqual({ oddsPart: "100/30", marker: "JFav" });
    expect(splitSpLabel("100/30JF")).toEqual({ oddsPart: "100/30", marker: "JFav" });
    expect(splitSpLabel("5/2F")).toEqual({ oddsPart: "5/2", marker: "F" });
    expect(spLabelMarksFavourite("100/30J")).toBe(true);
  });

  it("converts fractional SP to decimal while keeping F / Fav", () => {
    expect(formatSpOddsDisplay({ spFraction: "6/4 Fav" }, { decimal: true })).toBe(
      "2.50 Fav"
    );
    expect(formatSpOddsDisplay({ spFraction: "11/4 F" }, { decimal: true })).toBe("3.75 F");
    expect(formatSpOddsDisplay({ spFraction: "5/2 JFav" }, { decimal: true })).toBe(
      "3.50 JFav"
    );
  });

  it("converts glued joint-fav SP without inventing 100.00", () => {
    expect(
      formatSpOddsDisplay({ spFraction: "100/30J", spDecimal: 4.33 }, { decimal: true })
    ).toBe("4.33 JFav");
    expect(
      formatSpOddsDisplay(
        { spFraction: "100/30J", spDecimal: 4.33, isSpFavourite: true },
        { decimal: true }
      )
    ).toBe("4.33 JFav");
    expect(
      formatSpOddsDisplay({ spFraction: "100/30J", spDecimal: 4.33 }, { decimal: false })
    ).toBe("100/30 JFav");
  });

  it("keeps fractional display when decimal mode is off", () => {
    expect(formatSpOddsDisplay({ spFraction: "6/4 Fav" }, { decimal: false })).toBe(
      "6/4 Fav"
    );
  });

  it("adds F from isSpFavourite when the label has no marker", () => {
    expect(
      formatSpOddsDisplay(
        { spFraction: "2/1", spDecimal: 3, isSpFavourite: true },
        { decimal: true }
      )
    ).toBe("3.00 F");
    expect(spLabelMarksFavourite("2/1", true)).toBe(true);
    expect(spLabelMarksFavourite("6/4 F")).toBe(true);
    expect(spLabelMarksFavourite("9/2")).toBe(false);
  });
});

describe("formatWeightStones", () => {
  it("formats lbs as stones-pounds", () => {
    expect(formatWeightStones(135)).toBe("9-9");
  });
});
