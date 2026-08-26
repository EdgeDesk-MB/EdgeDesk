import { describe, expect, it } from "vitest";
import { estimateLayPlaceOdds } from "@/lib/calc/estimate-lay-place-odds";
import {
  deskRunnerLayPrices,
  deskRunnerLayWinOdds,
  deskRunnerWinOdds,
} from "./desk-bet-prefill";

describe("deskRunnerWinOdds", () => {
  it("prefers bookie over SP", () => {
    expect(deskRunnerWinOdds({ bookieDecimal: 5, spDecimal: 6 })).toBe(5);
  });

  it("falls back to SP then 8", () => {
    expect(deskRunnerWinOdds({ spDecimal: 6 })).toBe(6);
    expect(deskRunnerWinOdds({})).toBe(8);
  });
});

describe("deskRunnerLayWinOdds", () => {
  it("uses the live exchange lay from the desk row", () => {
    expect(deskRunnerLayWinOdds({ exchangeDecimal: 4.5 }, 5)).toBe(4.5);
  });

  it("estimates +3% when the exchange cell is empty", () => {
    expect(deskRunnerLayWinOdds({}, 5)).toBeCloseTo(5.15, 8);
  });
});

describe("deskRunnerLayPrices", () => {
  it("seeds win and place lays from the exchange win lay", () => {
    const prices = deskRunnerLayPrices(
      { bookieDecimal: 5, exchangeDecimal: 4.5 },
      0.2
    );
    expect(prices.winOdds).toBe(5);
    expect(prices.layWinOdds).toBe(4.5);
    expect(prices.layPlaceOdds).toBe(estimateLayPlaceOdds(4.5, 0.2));
    expect(prices.layPlaceOdds).not.toBe(estimateLayPlaceOdds(5, 0.2));
  });

  it("estimates both lays from bookie when exchange is missing", () => {
    const prices = deskRunnerLayPrices({ bookieDecimal: 5 }, 0.25);
    expect(prices.layWinOdds).toBeCloseTo(5.15, 8);
    expect(prices.layPlaceOdds).toBe(estimateLayPlaceOdds(5.15, 0.25));
  });
});
