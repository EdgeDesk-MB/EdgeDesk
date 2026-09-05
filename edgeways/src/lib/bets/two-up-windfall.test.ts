import { describe, expect, it } from "vitest";
import { twoUpBothWinProfit } from "./two-up-windfall";

describe("twoUpBothWinProfit", () => {
  it("adds bookie early-pay profit to lay winnings (2-2 after 2UP)", () => {
    // Back £50 @ 3.00 → +£100. Lay £48.70 @ 3.10, 2% → +£47.726. Combined £147.726.
    const profit = twoUpBothWinProfit({
      earlyPayout: 1,
      backStake: 50,
      backOdds: 3,
      layStake: 48.7,
      layOdds: 3.1,
      commission: 0.02,
    });
    expect(profit).toBeCloseTo(100 + 48.7 * 0.98, 10);
  });

  it("is null without a 2UP flag or a live lay", () => {
    const base = {
      earlyPayout: 1,
      backStake: 50,
      backOdds: 3,
      layStake: 48.7,
      layOdds: 3.1,
      commission: 0.02,
    };
    expect(twoUpBothWinProfit({ ...base, earlyPayout: 0 })).toBeNull();
    expect(twoUpBothWinProfit({ ...base, layStake: 0 })).toBeNull();
  });
});
