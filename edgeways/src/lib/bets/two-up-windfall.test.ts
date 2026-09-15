import { describe, expect, it } from "vitest";
import { executableLayStake, layPlanOutcome } from "@/lib/calc/layplan";
import { twoUp } from "@/lib/calc/twoup";
import {
  earlyPayoutBothWinSides,
  twoUpBothWinProfit,
  twoUpOddsAgainstPound,
} from "./two-up-windfall";

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

describe("earlyPayoutBothWinSides", () => {
  it("is bookie early-pay profit plus lay winnings, matching the 2UP windfall", () => {
    const input = {
      mode: "qualifying" as const,
      backStake: 50,
      backOdds: 3,
      layOdds: 3.1,
      commission: 0.02,
    };
    const layStake = executableLayStake(input);
    const preview = layPlanOutcome({ ...input, layStake });
    const sides = earlyPayoutBothWinSides(preview);
    expect(sides.bookie).toBe(preview.ifBackWins.bookie);
    expect(sides.exchange).toBe(preview.ifBackLoses.exchange);
    expect(sides.bookie + sides.exchange).toBeCloseTo(
      twoUp({
        backStake: input.backStake,
        backOdds: input.backOdds,
        layOdds: input.layOdds,
        commission: input.commission,
        layStakeOverride: layStake,
      }).windfallProfit,
      10
    );
  });
});

describe("twoUpOddsAgainstPound", () => {
  it("turns a £3.34 qualifier into 30.4/1 on a £101.67 2UP win", () => {
    // £101.67 / £3.34 = £30.44 profit per £1 of cost → 30.4/1 (decimal 31.44).
    const odds = twoUpOddsAgainstPound(-3.34, 101.67);
    expect(odds?.against).toBe("30.4/1");
    expect(odds?.decimal).toBeCloseTo(1 + 101.67 / 3.34, 10);
  });

  it("is null when there is no qualifying cost", () => {
    expect(twoUpOddsAgainstPound(0, 101.67)).toBeNull();
    expect(twoUpOddsAgainstPound(2.1, 101.67)).toBeNull();
    expect(twoUpOddsAgainstPound(-3.34, 0)).toBeNull();
  });
});
