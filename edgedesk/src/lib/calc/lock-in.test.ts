import { describe, expect, it } from "vitest";
import { lockInAdvice, lockInOutcome } from "./lock-in";

describe("lockInAdvice - lay direction (under-laid positions)", () => {
  // Back £50 @ 4.0, part-laid £20 @ 4.2, commission 0, lay price now 2.5.
  // Pre-trade: win = 150 − 20×3.2 = £86 · lose = −50 + 20 = −£30.
  // Equalising lay L = (86 − (−30)) / 2.5 = £46.40 →
  // win: 86 − 46.40×1.5 = £16.40 · lose: −30 + 46.40 = £16.40. Lock +£16.40.
  it("classic price crash: back 50@4.0 part-laid 20@4.2, now 2.5 → lay 46.40, lock +£16.40", () => {
    const r = lockInAdvice({
      mode: "qualifying",
      backStake: 50,
      backOdds: 4.0,
      layStake: 20,
      layOdds: 4.2,
      commission: 0,
      currentLayOdds: 2.5,
      currentBackOdds: 2.48,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("lay");
    expect(r.executableStake).toBeCloseTo(46.4, 10);
    expect(r.outcome.ifWin).toBeCloseTo(16.4, 10);
    expect(r.outcome.ifLose).toBeCloseTo(16.4, 10);
    expect(r.outcome.guaranteed).toBeCloseTo(16.4, 10);
    expect(r.preTrade.ifWin).toBeCloseTo(86, 10);
    expect(r.preTrade.ifLose).toBeCloseTo(-30, 10);
  });

  // Same position at 2% commission: L = (150+50−64−20×0.98)/(2.5−0.02)
  // = 116.4/2.48 = 46.935483…, executable pence-rounds to £46.94 →
  // win: 86 − 46.94×1.5 = £15.59 · lose: −50 + (20+46.94)×0.98 = £15.6012.
  it("commission shifts the equalising stake: 2% → lay £46.94, guaranteed £15.59", () => {
    const r = lockInAdvice({
      mode: "qualifying",
      backStake: 50,
      backOdds: 4.0,
      layStake: 20,
      layOdds: 4.2,
      commission: 0.02,
      currentLayOdds: 2.5,
      currentBackOdds: 2.48,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("lay");
    expect(r.fullStake).toBeCloseTo(116.4 / 2.48, 10);
    expect(r.executableStake).toBeCloseTo(46.94, 10);
    expect(r.outcome.ifWin).toBeCloseTo(86 - 46.94 * 1.5, 10);
    expect(r.outcome.ifLose).toBeCloseTo(-50 + (20 + 46.94) * 0.98, 10);
    expect(r.outcome.guaranteed).toBeCloseTo(15.59, 10);
  });

  // Back-only (no lay yet): back £25 @ 3.0, now 2.8 → full lay-to-lock
  // L = 75/2.8 = 26.785714… → both sides 75/2.8 − 25 = £1.785714…
  it("back-only position: back 25@3.0, now 2.8 → lay 26.79 to lock ~+£1.79", () => {
    const r = lockInAdvice({
      mode: "qualifying",
      backStake: 25,
      backOdds: 3.0,
      layStake: 0,
      layOdds: 0,
      commission: 0,
      currentLayOdds: 2.8,
      currentBackOdds: 2.78,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("lay");
    expect(r.executableStake).toBeCloseTo(26.79, 10);
    // At the pence-rounded stake the two sides straddle the ideal £1.7857
    expect(r.outcome.ifWin).toBeCloseTo(50 - 26.79 * 1.8, 10);
    expect(r.outcome.ifLose).toBeCloseTo(-25 + 26.79, 10);
    expect(r.outcome.guaranteed).toBeCloseTo(50 - 26.79 * 1.8, 10);
  });
});

describe("lockInAdvice - back direction (over-laid positions)", () => {
  // Back £50 @ 4.0 laid £48 @ 4.2 (near-full lay), commission 0.
  // Pre-trade: win = 150 − 153.6 = −£3.60 · lose = −50 + 48 = −£2.00.
  // Win side is worse → back on the exchange at 2.5:
  // E = (−2 − (−3.6)) / ((2.5−1)×1 + 1) = 1.6/2.5 = £0.64 →
  // win: −3.6 + 0.64×1.5 = −£2.64 · lose: −2 − 0.64 = −£2.64.
  it("over-laid qualifier: back 50@4.0 laid 48@4.2, back now 2.5 → back £0.64, lock −£2.64", () => {
    const r = lockInAdvice({
      mode: "qualifying",
      backStake: 50,
      backOdds: 4.0,
      layStake: 48,
      layOdds: 4.2,
      commission: 0,
      currentLayOdds: 2.52,
      currentBackOdds: 2.5,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("back");
    expect(r.executableStake).toBeCloseTo(0.64, 10);
    expect(r.outcome.ifWin).toBeCloseTo(-2.64, 10);
    expect(r.outcome.ifLose).toBeCloseTo(-2.64, 10);
  });

  // Free bet SNR £25 @ 5.0 laid £20 @ 5.4, price drifts OUT, back now 7.8.
  // Pre-trade: win = 100 − 88 = £12 · lose = 0 + 20 = £20 (SNR loses nothing).
  // E = (20 − 12)/((7.8−1)×1 + 1) = 8/7.8 = 1.025641… → ~£1.03 →
  // win: 12 + 1.03×6.8 = £19.004 · lose: 20 − 1.03 = £18.97.
  it("free SNR with drifting price: lock ~+£18.97 by backing £1.03 at 7.8", () => {
    const r = lockInAdvice({
      mode: "free_snr",
      backStake: 25,
      backOdds: 5.0,
      layStake: 20,
      layOdds: 5.4,
      commission: 0,
      currentLayOdds: 8.0,
      currentBackOdds: 7.8,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("back");
    expect(r.executableStake).toBeCloseTo(1.03, 10);
    expect(r.outcome.ifWin).toBeCloseTo(12 + 1.03 * 6.8, 10);
    expect(r.outcome.ifLose).toBeCloseTo(20 - 1.03, 10);
    expect(r.outcome.guaranteed).toBeCloseTo(18.97, 10);
  });

  // 5% commission applies to BOTH exchange winnings: the original lay's
  // lose-side return becomes 20×0.95 = £19, and the new back's winnings are
  // haircut too. Pre-trade: win £12 · lose £19.
  // E = (19−12)/((6.8×0.95) + 1) = 7/7.46 = 0.938337… → £0.94 →
  // win: 12 + 0.94×6.8×0.95 = £18.0724 · lose: 19 − 0.94 = £18.06.
  it("back-direction commission haircuts the new back's winnings", () => {
    const r = lockInAdvice({
      mode: "free_snr",
      backStake: 25,
      backOdds: 5.0,
      layStake: 20,
      layOdds: 5.4,
      commission: 0.05,
      currentLayOdds: 8.0,
      currentBackOdds: 7.8,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("back");
    expect(r.fullStake).toBeCloseTo(7 / 7.46, 10);
    expect(r.executableStake).toBeCloseTo(0.94, 10);
    expect(r.outcome.ifWin).toBeCloseTo(12 + 0.94 * 6.8 * 0.95, 10);
    expect(r.outcome.ifLose).toBeCloseTo(19 - 0.94, 10);
    expect(r.preTrade.ifLose).toBeCloseTo(19, 10);
  });
});

describe("lockInAdvice - already balanced and guards", () => {
  // Back £10 @ 3.0 laid £10.34… so both sides are within half a penny:
  // lay 30/2.9 = 10.344827… at 2.9 → win = lose exactly.
  it("an already-equalised position advises no trade", () => {
    const r = lockInAdvice({
      mode: "qualifying",
      backStake: 10,
      backOdds: 3.0,
      layStake: 30 / 2.9,
      layOdds: 2.9,
      commission: 0,
      currentLayOdds: 2.9,
      currentBackOdds: 2.88,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("none");
    expect(r.executableStake).toBe(0);
    expect(r.outcome.ifWin).toBeCloseTo(r.outcome.ifLose, 2);
  });

  // Risk-free: back £20 @ 4.0 (refund £20 at 70% retention), laid £15 @ 4.1,
  // commission 0, lay now 2.0. Pre-trade: win = 60 − 46.5 = £13.50 ·
  // lose = (−20 + 14) + 15 = £9.00. L = 4.5/2.0 = £2.25 → lock +£11.25 both ways.
  it("risk_free refund flows through: lock +£11.25", () => {
    const r = lockInAdvice({
      mode: "risk_free",
      backStake: 20,
      backOdds: 4.0,
      layStake: 15,
      layOdds: 4.1,
      commission: 0,
      currentLayOdds: 2.0,
      currentBackOdds: 1.98,
      refundAmount: 20,
      refundRetention: 0.7,
    });
    if (!r) throw new Error("expected advice");
    expect(r.direction).toBe("lay");
    expect(r.executableStake).toBeCloseTo(2.25, 10);
    expect(r.outcome.ifWin).toBeCloseTo(11.25, 10);
    expect(r.outcome.ifLose).toBeCloseTo(11.25, 10);
  });

  it("a claimed lay at impossible odds returns null", () => {
    expect(
      lockInAdvice({
        mode: "qualifying",
        backStake: 10,
        backOdds: 3.0,
        layStake: 10,
        layOdds: 1,
        commission: 0,
        currentLayOdds: 2.5,
        currentBackOdds: 2.4,
      })
    ).toBeNull();
  });

  it("nonsense inputs return null", () => {
    const base = {
      mode: "qualifying" as const,
      backStake: 10,
      backOdds: 3.0,
      layStake: 0,
      layOdds: 0,
      commission: 0,
    };
    expect(lockInAdvice({ ...base, currentLayOdds: 1, currentBackOdds: 2 })).toBeNull();
    expect(lockInAdvice({ ...base, currentLayOdds: 2.5, currentBackOdds: 0.9 })).toBeNull();
    expect(lockInAdvice({ ...base, backStake: 0, currentLayOdds: 2.5, currentBackOdds: 2.4 })).toBeNull();
  });
});

describe("lockInOutcome - partial locks (the slider)", () => {
  // Half of the classic full lock (46.40 → 23.20 at 2.5):
  // win: 86 − 23.20×1.5 = £51.20 · lose: −30 + 23.20 = −£6.80.
  it("half the equalising lay keeps half the upside", () => {
    const o = lockInOutcome(
      {
        mode: "qualifying",
        backStake: 50,
        backOdds: 4.0,
        layStake: 20,
        layOdds: 4.2,
        commission: 0,
        currentLayOdds: 2.5,
        currentBackOdds: 2.48,
      },
      "lay",
      23.2
    );
    expect(o.ifWin).toBeCloseTo(51.2, 10);
    expect(o.ifLose).toBeCloseTo(-6.8, 10);
    expect(o.guaranteed).toBeCloseTo(-6.8, 10);
  });

  it("zero stake reproduces the pre-trade position", () => {
    const o = lockInOutcome(
      {
        mode: "qualifying",
        backStake: 50,
        backOdds: 4.0,
        layStake: 20,
        layOdds: 4.2,
        commission: 0,
        currentLayOdds: 2.5,
        currentBackOdds: 2.48,
      },
      "lay",
      0
    );
    expect(o.ifWin).toBeCloseTo(86, 10);
    expect(o.ifLose).toBeCloseTo(-30, 10);
  });
});
