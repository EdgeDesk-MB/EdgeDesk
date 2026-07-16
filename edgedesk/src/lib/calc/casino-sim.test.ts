import { describe, expect, it } from "vitest";
import {
  VOLATILITY_PRESETS,
  expectedSpinReturn,
  mulberry32,
  scaledLadder,
  simulateWagering,
} from "./casino-sim";
import { casinoOfferEv } from "./casino-ev";

describe("volatility presets - spec'd constants", () => {
  // Hand-worked conditional expectations per hit:
  // low:    0.60×1.6 + 0.30×4.0 + 0.09×10 + 0.01×40                    = 3.46
  // medium: 0.55×1.8 + 0.30×4.5 + 0.12×12 + 0.025×45 + 0.005×180      = 5.805
  // high:   0.50×2.2 + 0.30×6 + 0.15×15 + 0.04×70 + 0.009×350 + 0.001×2500 = 13.6
  it("ladder probabilities are complete and hit rates match the spec", () => {
    for (const [name, preset] of Object.entries(VOLATILITY_PRESETS)) {
      const pSum = preset.ladder.reduce((a, s) => a + s.p, 0);
      expect(pSum, name).toBeCloseTo(1, 12);
    }
    expect(VOLATILITY_PRESETS.low.hitRate).toBe(0.3);
    expect(VOLATILITY_PRESETS.medium.hitRate).toBe(0.22);
    expect(VOLATILITY_PRESETS.high.hitRate).toBe(0.15);
  });

  it("hand-worked base expectations: 3.46 / 5.805 / 13.6 per hit", () => {
    const eHit = (name: "low" | "medium" | "high") =>
      VOLATILITY_PRESETS[name].ladder.reduce((a, s) => a + s.p * s.multiplier, 0);
    expect(eHit("low")).toBeCloseTo(3.46, 12);
    expect(eHit("medium")).toBeCloseTo(5.805, 12);
    expect(eHit("high")).toBeCloseTo(13.6, 12);
  });

  it("scaling calibrates E[return per unit staked] to the RTP exactly", () => {
    for (const vol of ["low", "medium", "high"] as const) {
      for (const rtp of [0.999, 0.96, 0.85, 0.5]) {
        expect(expectedSpinReturn(vol, rtp), `${vol}@${rtp}`).toBeCloseTo(rtp, 12);
      }
    }
  });

  it("the scaled ladder keeps its shape: high volatility keeps a long tail", () => {
    const low = scaledLadder("low", 0.96);
    const high = scaledLadder("high", 0.96);
    const maxLow = Math.max(...low.steps.map((s) => s.multiplier));
    const maxHigh = Math.max(...high.steps.map((s) => s.multiplier));
    expect(maxHigh).toBeGreaterThan(maxLow * 10);
    expect(high.hitRate).toBeLessThan(low.hitRate);
  });
});

describe("mulberry32", () => {
  it("is deterministic per seed and uniform-ish in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = Array.from({ length: 5 }, a);
    const seqB = Array.from({ length: 5 }, b);
    const seqC = Array.from({ length: 5 }, c);
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("simulateWagering", () => {
  const base = {
    bonusAmount: 20,
    wageringMultiplier: 35,
    houseEdge: 0.04,
    contributionPct: 1,
    volatility: "medium" as const,
    spinStake: 0.4,
    runs: 2000,
    seed: 42,
  };

  it("is deterministic for a seed and differs across seeds", () => {
    const a = simulateWagering(base);
    const b = simulateWagering(base);
    const c = simulateWagering({ ...base, seed: 43 });
    if (!a || !b || !c) throw new Error("expected results");
    expect(a).toEqual(b);
    expect(a.meanEv).not.toBe(c.meanEv);
  });

  it("histogram counts account for every run", () => {
    const r = simulateWagering(base);
    if (!r) throw new Error("expected result");
    expect(r.histogram.counts.reduce((a, b) => a + b, 0)).toBe(base.runs);
    expect(r.histogram.edges.length).toBe(r.histogram.counts.length + 1);
  });

  it("zero wagering is cash: every run keeps the full bonus", () => {
    const r = simulateWagering({ ...base, wageringMultiplier: 0 });
    if (!r) throw new Error("expected result");
    expect(r.bustPct).toBe(0);
    expect(r.median).toBe(20);
    expect(r.meanEv).toBe(20);
  });

  // The martingale identity: every spin loses stake×edge in expectation, so
  // mean(final) must equal bonus − edge × mean(total staked) up to sampling
  // noise. Seeded, so this never flakes.
  it("internal consistency: meanEv = bonus − edge × meanStaked (within noise)", () => {
    const r = simulateWagering({ ...base, runs: 20_000 });
    if (!r) throw new Error("expected result");
    expect(Math.abs(r.meanEv - (base.bonusAmount - base.houseEdge * r.meanStaked))).toBeLessThan(1);
  });

  // Where busts are vanishingly rare the sim must converge on the H2
  // analytic EV: £20 through 1× wagering at 2% edge → drag £0.40, ev £19.60.
  it("converges on casinoOfferEv where bust risk is negligible", () => {
    const input = {
      bonusAmount: 20,
      wageringMultiplier: 1,
      houseEdge: 0.02,
      contributionPct: 1,
      volatility: "low" as const,
      spinStake: 0.5,
      runs: 20_000,
      seed: 7,
    };
    const r = simulateWagering(input);
    if (!r) throw new Error("expected result");
    const analytic = casinoOfferEv(input).ev;
    expect(analytic).toBeCloseTo(19.6, 10);
    expect(r.bustPct).toBeLessThan(0.01);
    expect(Math.abs(r.meanEv - analytic)).toBeLessThan(0.35);
    expect(r.analyticEv).toBeCloseTo(19.6, 10);
  });

  // Heavy wagering: the analytic model says −£52 (drag beyond the bonus),
  // but a session can only lose the bonus - busting truncates the loss, so
  // the sim's mean sits at or above zero and the distribution is bimodal.
  it("heavy wagering: busts truncate losses below the analytic EV", () => {
    const input = {
      bonusAmount: 20,
      wageringMultiplier: 60,
      houseEdge: 0.06,
      contributionPct: 1,
      volatility: "high" as const,
      spinStake: 0.4,
      runs: 4000,
      seed: 11,
    };
    const r = simulateWagering(input);
    if (!r) throw new Error("expected result");
    expect(casinoOfferEv(input).ev).toBeCloseTo(-52, 10);
    // 60× £20 at 6% edge is brutal: over 90% of runs bust (p90 is £0 too) -
    // but the survivors carry the mean, so it stays at/above zero, never −£52.
    expect(r.bustPct).toBeGreaterThan(0.5);
    expect(r.bustPct).toBeLessThan(1);
    expect(r.median).toBe(0);
    expect(r.meanEv).toBeGreaterThanOrEqual(0);
  });

  it("quantiles are ordered and busts pin p10 at zero when frequent", () => {
    const r = simulateWagering({ ...base, wageringMultiplier: 60, houseEdge: 0.06, volatility: "high", seed: 11 });
    if (!r) throw new Error("expected result");
    expect(r.p10).toBeLessThanOrEqual(r.median);
    expect(r.median).toBeLessThanOrEqual(r.p90);
    expect(r.p10).toBe(0);
  });

  // Parity in a NON-exact-pence regime (calc-auditor case): £5 through 1×
  // at 3.5% edge → staged rounding gives 4.82, a single terminal round
  // gives 4.83. The sim must show casinoOfferEv's figure, to the penny.
  it("analyticEv equals casinoOfferEv exactly, including rounding order", () => {
    const input = {
      bonusAmount: 5,
      wageringMultiplier: 1,
      houseEdge: 0.035,
      contributionPct: 1,
      volatility: "low" as const,
      spinStake: 0.2,
      runs: 100,
      seed: 3,
    };
    const r = simulateWagering(input);
    if (!r) throw new Error("expected result");
    expect(casinoOfferEv(input).ev).toBe(4.82);
    expect(r.analyticEv).toBe(4.82);
  });

  it("guards nonsense inputs", () => {
    expect(simulateWagering({ ...base, bonusAmount: 0 })).toBeNull();
    expect(simulateWagering({ ...base, spinStake: 0 })).toBeNull();
    expect(simulateWagering({ ...base, runs: 0 })).toBeNull();
  });
});
