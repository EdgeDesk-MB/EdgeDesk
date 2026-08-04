import { describe, expect, it } from "vitest";
import {
  formatLiveMarkets,
  liveMarketsFromRemaining,
  liveMatchStateModel,
  remainingTimeFactor,
  NEUTRAL_PREMATCH,
} from "./live-model";
import { fitModel, scoreGrid } from "./engine";

describe("remainingTimeFactor", () => {
  it("is 1 at kick-off", () => {
    expect(remainingTimeFactor(0)).toBe(1);
  });

  it("is ~0.5 at half-time", () => {
    expect(remainingTimeFactor(45)).toBeCloseTo(0.5, 5);
  });

  it("floors late so intensity never hits zero", () => {
    expect(remainingTimeFactor(90)).toBe(0.08);
    expect(remainingTimeFactor(95)).toBe(0.08);
  });
});

describe("liveMatchStateModel", () => {
  const even = { tH: 1 / 3, tD: 1 / 3, tA: 1 / 3 };

  it("at 0' 0-0 is close to pre-match markets", () => {
    const pre = fitModel(even.tH, even.tD, even.tA);
    const preM = (() => {
      const g = scoreGrid(pre.lh, pre.la, pre.rho, 12);
      let H = 0,
        D = 0,
        A = 0;
      for (let i = 0; i < g.length; i++)
        for (let j = 0; j < g[i].length; j++) {
          if (i > j) H += g[i][j];
          else if (i === j) D += g[i][j];
          else A += g[i][j];
        }
      return { H, D, A };
    })();

    const live = liveMatchStateModel(even, { minute: 0, homeScore: 0, awayScore: 0 });
    expect(live.markets.H).toBeCloseTo(preM.H, 2);
    expect(live.markets.D).toBeCloseTo(preM.D, 2);
    expect(live.markets.A).toBeCloseTo(preM.A, 2);
  });

  it("2-0 at 60' makes home win very likely", () => {
    const live = liveMatchStateModel(even, {
      minute: 60,
      homeScore: 2,
      awayScore: 0,
    });
    expect(live.markets.H).toBeGreaterThan(0.85);
    expect(live.markets.A).toBeLessThan(0.08);
  });

  it("0-0 at 80' raises draw probability vs kick-off", () => {
    const kick = liveMatchStateModel(even, { minute: 0, homeScore: 0, awayScore: 0 });
    const late = liveMatchStateModel(even, { minute: 80, homeScore: 0, awayScore: 0 });
    expect(late.markets.D).toBeGreaterThan(kick.markets.D);
  });

  it("sums to ~1", () => {
    const live = liveMatchStateModel(NEUTRAL_PREMATCH, {
      minute: 55,
      homeScore: 1,
      awayScore: 1,
    });
    const sum = live.markets.H + live.markets.D + live.markets.A;
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("liveMarketsFromRemaining", () => {
  it("with no remaining goals locks the current score", () => {
    // Degenerate: only (0,0) remaining mass
    const g = [[1]];
    const m = liveMarketsFromRemaining(g, 1, 0);
    expect(m.H).toBe(1);
    expect(m.D).toBe(0);
    expect(m.A).toBe(0);
    expect(m.BT).toBe(0);
  });
});

describe("formatLiveMarkets", () => {
  it("formats percentages", () => {
    expect(formatLiveMarkets({ H: 0.421, D: 0.279, A: 0.3, OV: 0.5, BT: 0.5 })).toBe(
      "H 42% · D 28% · A 30%"
    );
  });
});
