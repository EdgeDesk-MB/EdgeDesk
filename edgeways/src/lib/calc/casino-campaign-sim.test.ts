import { describe, expect, it } from "vitest";
import { houseEdgeFromRtp } from "./casino-ev";
import {
  GOLDEN_CHIP_PAYOUT_MULTIPLIER,
  simulateCampaignFinals,
  simulateCampaignRun,
  simulateGoldenChipReturn,
  simulateSpinsSession,
  summariseCampaignFinals,
  type CampaignSimComponent,
} from "./casino-campaign-sim";
import { mulberry32, runSession, sessionParams } from "./casino-sim";
import {
  freeSpinsEv,
  goldenChipsEv,
  qualifyingWagerDrag,
  sumCampaignEv,
} from "./casino-reward-ev";

describe("simulateSpinsSession", () => {
  it("converges on freeSpinsEv's spinWinnings: 20 spins @ £0.40 @ 95% RTP → £7.60", () => {
    const rng = mulberry32(1);
    const totals: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      totals.push(simulateSpinsSession(20, 0.4, "low", 0.95, rng));
    }
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const analytic = freeSpinsEv({ spins: 20, spinValue: 0.4, houseEdge: 0.05 }).spinWinnings;
    expect(analytic).toBe(7.6);
    expect(Math.abs(mean - analytic)).toBeLessThan(0.35);
  });

  it("zero spins or zero spin value yields zero (guard, never NaN)", () => {
    const rng = mulberry32(1);
    expect(simulateSpinsSession(0, 1, "low", 0.95, rng)).toBe(0);
    expect(simulateSpinsSession(10, 0, "low", 0.95, rng)).toBe(0);
  });

  it("is deterministic for a given rng sequence", () => {
    const a = simulateSpinsSession(20, 0.4, "medium", 0.95, mulberry32(5));
    const b = simulateSpinsSession(20, 0.4, "medium", 0.95, mulberry32(5));
    expect(a).toBe(b);
  });
});

describe("simulateGoldenChipReturn", () => {
  it("mean converges on goldenChipsEv's per-chip EV: £5 chip @ European edge (2.70%)", () => {
    const rng = mulberry32(2);
    const edge = 0.027;
    const draws: number[] = [];
    for (let i = 0; i < 50_000; i++) {
      draws.push(simulateGoldenChipReturn(5, edge, rng));
    }
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    const analyticPerChip = goldenChipsEv({ chipCount: 1, chipValue: 5, houseEdge: edge }).ev;
    expect(Math.abs(mean - analyticPerChip)).toBeLessThan(0.05);
  });

  it("p × payoutMultiplier = 1 − houseEdge exactly, by construction", () => {
    const edge = 0.0526;
    const p = (1 - edge) / GOLDEN_CHIP_PAYOUT_MULTIPLIER;
    expect(p * GOLDEN_CHIP_PAYOUT_MULTIPLIER).toBeCloseTo(1 - edge, 10);
  });

  it("zero or negative chip value yields zero (guard, never NaN)", () => {
    const rng = mulberry32(1);
    expect(simulateGoldenChipReturn(0, 0.027, rng)).toBe(0);
    expect(simulateGoldenChipReturn(-5, 0.027, rng)).toBe(0);
  });
});

describe("simulateCampaignRun", () => {
  it("a bonus-only campaign matches runSession's own output exactly, same seed", () => {
    const input = {
      bonusAmount: 20,
      wageringMultiplier: 35,
      houseEdge: 0.04,
      contributionPct: 1,
      volatility: "medium" as const,
      spinStake: 0.4,
    };
    const params = sessionParams(input);
    if (!params) throw new Error("expected params");
    const direct = runSession(params, mulberry32(9));

    const components: CampaignSimComponent[] = [
      { componentType: "bonus", amount: 20, wageringMultiplier: 35, rtp: 0.96, contributionPct: 1 },
    ];
    const composed = simulateCampaignRun(components, "medium", mulberry32(9));
    expect(composed).toBe(direct.final);
  });

  it("a cash-only campaign is deterministic and exact - EV equals the amount every run", () => {
    const components: CampaignSimComponent[] = [{ componentType: "cash", amount: 15 }];
    for (const seed of [1, 2, 3]) {
      expect(simulateCampaignRun(components, "low", mulberry32(seed))).toBe(15);
    }
  });

  it("qualifying_wager converges on qualifyingWagerDrag: £100 @ 96% RTP → −£4.00", () => {
    const components: CampaignSimComponent[] = [
      { componentType: "qualifying_wager", amount: 100, rtp: 0.96 },
    ];
    const rng = mulberry32(3);
    const runs: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      runs.push(simulateCampaignRun(components, "low", rng));
    }
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    const analytic = qualifyingWagerDrag({ amount: 100, houseEdge: 0.04 }).ev;
    expect(analytic).toBe(-4);
    expect(Math.abs(mean - analytic)).toBeLessThan(1);
  });

  it("the Grosvenor combined campaign converges on sumCampaignEv: qualifying wager + free spins → £3.60", () => {
    const components: CampaignSimComponent[] = [
      { componentType: "qualifying_wager", amount: 100, rtp: 0.96 },
      { componentType: "free_spins", spins: 20, spinValue: 0.4, rtp: 0.95 },
    ];
    const rng = mulberry32(4);
    const runs: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      runs.push(simulateCampaignRun(components, "low", rng));
    }
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    const analytic = sumCampaignEv([
      { expectedEv: qualifyingWagerDrag({ amount: 100, houseEdge: 0.04 }).ev },
      { expectedEv: freeSpinsEv({ spins: 20, spinValue: 0.4, houseEdge: 0.05 }).ev },
    ]);
    expect(analytic).toBe(3.6);
    expect(Math.abs(mean - analytic)).toBeLessThan(1);
  });

  it("free_spins winnings-wagering (stage 2) chains and converges under light drag", () => {
    // Light winnings-wager (1x at 2% edge, same negligible-bust-risk shape as
    // casino-sim.test.ts's own "converges on casinoOfferEv" case) so stage 2's
    // chained session isn't dominated by bust-truncation bias - proves the
    // chaining wiring is correct, not the heavy-drag truncation behaviour
    // (that's covered separately; see the module doc for why heavy drag
    // pushes the simulated mean above the analytic figure, same as J4).
    const components: CampaignSimComponent[] = [
      {
        componentType: "free_spins",
        spins: 20,
        spinValue: 1,
        rtp: 0.98,
        wageringMultiplier: 1,
        contributionPct: 1,
      },
    ];
    const rng = mulberry32(6);
    const runs: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      runs.push(simulateCampaignRun(components, "low", rng));
    }
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    const analytic = freeSpinsEv({
      spins: 20,
      spinValue: 1,
      houseEdge: 0.02,
      winningsWagerX: 1,
      contributionPct: 1,
    }).ev;
    expect(analytic).toBe(19.21);
    expect(Math.abs(mean - analytic)).toBeLessThan(1.5);
  });

  it("golden_chips converges on goldenChipsEv: 10 chips @ £5 @ European edge → £48.65", () => {
    const edge = 0.027;
    const components: CampaignSimComponent[] = [
      { componentType: "golden_chips", chipCount: 10, chipValue: 5, rtp: 1 - edge },
    ];
    const rng = mulberry32(8);
    const runs: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      runs.push(simulateCampaignRun(components, "low", rng));
    }
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    const analytic = goldenChipsEv({ chipCount: 10, chipValue: 5, houseEdge: edge }).ev;
    expect(analytic).toBe(48.65);
    expect(Math.abs(mean - analytic)).toBeLessThan(1);
  });

  // Real cashback never rebates a WINNING session - actualLoss clamps at 0,
  // so E[max(0, turnover − final)] >= max(0, turnover − E[final])
  // (Jensen's inequality on the convex clamp). The simulated mean therefore
  // sits AT OR ABOVE the naive unclamped `turnover × edge × pct` figure -
  // an honest divergence in the same spirit as the module's documented
  // bust-truncation bias for Bonus, not a bug. So these are structural
  // checks, not a tight numeric convergence assertion.
  it("cashback mean is positive and at least the naive expected-loss floor", () => {
    const components: CampaignSimComponent[] = [
      { componentType: "cashback", amount: 500, rtp: 0.96, cashbackPct: 0.1 },
    ];
    const rng = mulberry32(10);
    const runs: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      runs.push(simulateCampaignRun(components, "low", rng));
    }
    const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
    expect(mean).toBeGreaterThan(0);
    const naiveFloor = 500 * houseEdgeFromRtp(0.96) * 0.1;
    expect(mean).toBeGreaterThanOrEqual(naiveFloor - 0.5);
  });

  it("cashback mean scales up with a higher cashbackPct", () => {
    const meanFor = (pct: number) => {
      const components: CampaignSimComponent[] = [
        { componentType: "cashback", amount: 500, rtp: 0.96, cashbackPct: pct },
      ];
      const rng = mulberry32(20);
      const runs: number[] = [];
      for (let i = 0; i < 10_000; i++) runs.push(simulateCampaignRun(components, "low", rng));
      return runs.reduce((a, b) => a + b, 0) / runs.length;
    };
    expect(meanFor(0.2)).toBeGreaterThan(meanFor(0.1));
  });

  it("cashback never exceeds its cap on any single run", () => {
    const components: CampaignSimComponent[] = [
      { componentType: "cashback", amount: 2000, rtp: 0.8, cashbackPct: 0.5, cashbackCap: 5 },
    ];
    const rng = mulberry32(30);
    for (let i = 0; i < 500; i++) {
      expect(simulateCampaignRun(components, "high", rng)).toBeLessThanOrEqual(5);
    }
  });

  it("empty component list sums to zero every run", () => {
    expect(simulateCampaignRun([], "low", mulberry32(1))).toBe(0);
  });
});

describe("simulateCampaignFinals / summariseCampaignFinals", () => {
  const components: CampaignSimComponent[] = [
    { componentType: "qualifying_wager", amount: 100, rtp: 0.96 },
    { componentType: "free_spins", spins: 20, spinValue: 0.4, rtp: 0.95 },
  ];

  it("histogram counts account for every run", () => {
    const finals: number[] = [];
    simulateCampaignFinals(components, "medium", 2000, mulberry32(1), finals);
    const result = summariseCampaignFinals(finals, 3.6);
    expect(result.histogram.counts.reduce((a, b) => a + b, 0)).toBe(2000);
    expect(result.histogram.edges.length).toBe(result.histogram.counts.length + 1);
    expect(result.runs).toBe(2000);
  });

  it("is deterministic for a seed", () => {
    const a: number[] = [];
    const b: number[] = [];
    simulateCampaignFinals(components, "medium", 500, mulberry32(42), a);
    simulateCampaignFinals(components, "medium", 500, mulberry32(42), b);
    expect(a).toEqual(b);
  });

  it("quantiles are ordered", () => {
    const finals: number[] = [];
    simulateCampaignFinals(components, "high", 4000, mulberry32(11), finals);
    const result = summariseCampaignFinals(finals, 3.6);
    expect(result.p10).toBeLessThanOrEqual(result.median);
    expect(result.median).toBeLessThanOrEqual(result.p90);
  });

  it("lossPct is a valid fraction reflecting net-negative runs", () => {
    // Qualifying-wager-only campaign has negative mean, so a majority of runs lose.
    const qOnly: CampaignSimComponent[] = [
      { componentType: "qualifying_wager", amount: 100, rtp: 0.9 },
    ];
    const finals: number[] = [];
    simulateCampaignFinals(qOnly, "high", 4000, mulberry32(1), finals);
    const result = summariseCampaignFinals(finals, -10);
    expect(result.lossPct).toBeGreaterThan(0);
    expect(result.lossPct).toBeLessThanOrEqual(1);
  });

  it("analyticEv is carried through and rounded to the penny", () => {
    const finals: number[] = [0];
    const result = summariseCampaignFinals(finals, 3.604);
    expect(result.analyticEv).toBe(3.6);
  });
});
