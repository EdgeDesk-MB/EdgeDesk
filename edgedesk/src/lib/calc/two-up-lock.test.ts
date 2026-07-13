import { describe, expect, it } from "vitest";
import { suggestTwoUpLock } from "./two-up-lock";

describe("suggestTwoUpLock", () => {
  /**
   * Worked example: back £25 @ 2.5 (bookie, 2UP), lay £24 @ 2.6 at 2%.
   * Early payout triggers: bookie profit locked = 25 × 1.5 = £37.50.
   * If selection wins:  37.50 − 24 × 1.6      = −£0.90
   * If it doesn't:      37.50 + 24 × 0.98     = +£61.02
   * Live win probability 0.80 → fair back odds 1.25.
   * Exchange back of s at 1.25 (2% on winnings):
   *   s = (61.02 − (−0.90)) / (1 + 0.25 × 0.98) = 61.92 / 1.245 = £49.73
   *   locked = 61.02 − 49.7349… = £11.29 (either way)
   */
  it("computes the commission-aware equalising back and locked profit", () => {
    const s = suggestTwoUpLock({
      backStake: 25,
      backOdds: 2.5,
      layStake: 24,
      layOdds: 2.6,
      commission: 0.02,
      liveWinProb: 0.8,
    });
    expect(s).not.toBeNull();
    expect(s!.fairBackOdds).toBeCloseTo(1.25, 10);
    expect(s!.backStake).toBeCloseTo(49.73, 2);
    expect(s!.lockedProfit).toBeCloseTo(11.29, 2);
    expect(s!.ifWinUnhedged).toBeCloseTo(-0.9, 10);
    expect(s!.ifNotWinUnhedged).toBeCloseTo(61.02, 10);
  });

  it("locks both outcomes to the same value (invariant)", () => {
    const s = suggestTwoUpLock({
      backStake: 50,
      backOdds: 3.2,
      layStake: 51,
      layOdds: 3.35,
      commission: 0.05,
      liveWinProb: 0.72,
    })!;
    // backStake is rounded to the penny (real stakes are), so the two
    // outcomes agree to the penny rather than to float precision.
    const win = s.ifWinUnhedged + s.backStake * (s.fairBackOdds - 1) * (1 - 0.05);
    const notWin = s.ifNotWinUnhedged - s.backStake;
    expect(win).toBeCloseTo(notWin, 2);
    expect(win).toBeCloseTo(s.lockedProfit, 2);
  });

  it("no lay means the payout is already locked - suggests nothing to do", () => {
    const s = suggestTwoUpLock({
      backStake: 25,
      backOdds: 2.5,
      layStake: 0,
      layOdds: 0,
      commission: 0.02,
      liveWinProb: 0.8,
    })!;
    expect(s.backStake).toBe(0);
    expect(s.lockedProfit).toBeCloseTo(37.5, 10);
  });

  it("returns null for unusable probabilities", () => {
    const base = {
      backStake: 25,
      backOdds: 2.5,
      layStake: 24,
      layOdds: 2.6,
      commission: 0.02,
    };
    expect(suggestTwoUpLock({ ...base, liveWinProb: 0 })).toBeNull();
    expect(suggestTwoUpLock({ ...base, liveWinProb: 1 })).toBeNull();
    expect(suggestTwoUpLock({ ...base, liveWinProb: Number.NaN })).toBeNull();
  });
});
