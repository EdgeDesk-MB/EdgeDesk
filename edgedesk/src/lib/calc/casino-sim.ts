/**
 * Casino variance simulator (J4) - Monte Carlo over a wagering offer,
 * extending H2's variance tiers into honest distributions: bust probability,
 * median, percentile band and a histogram.
 *
 * THE MODEL IS STYLISED, NOT REAL GAME MATHS. Each volatility preset is a
 * small spec'd multiplier ladder (hit rate + conditional multiplier
 * distribution) whose multipliers are linearly scaled so that the expected
 * return per unit staked equals the game's RTP EXACTLY. Real slots have
 * thousands of outcomes; these ladders reproduce the SHAPE of low/medium/
 * high volatility, calibrated to the right mean.
 *
 * Session semantics: the balance starts at the bonus; each spin stakes
 * min(spinStake, balance); every £1 staked clears £contribution of the
 * requirement; bust below 1p ends the run at £0. Because busting truncates
 * losses at the bonus, the simulated mean can sit ABOVE the analytic
 * `casinoOfferEv()` figure when the drag exceeds the bonus - the analytic
 * model assumes the full turnover is always cycled. Where busts are rare
 * the two agree (and a test pins that convergence).
 *
 * Deterministic: mulberry32 seeded PRNG, so identical inputs + seed give
 * identical distributions (tests rely on this; the UI seeds from the offer).
 */

import { casinoOfferEv } from "./casino-ev";
import { roundPence } from "./money";

export type SlotVolatility = "low" | "medium" | "high";

export interface LadderStep {
  /** Probability of this multiplier, conditional on a hit */
  p: number;
  /** Payout multiplier on the stake (unscaled base value) */
  multiplier: number;
}

/**
 * SPEC'D CONSTANTS (J4). Conditional expectations per hit are hand-worked
 * in casino-sim.test.ts: low 3.46 · medium 5.805 · high 13.6.
 */
export const VOLATILITY_PRESETS: Record<
  SlotVolatility,
  { hitRate: number; ladder: LadderStep[] }
> = {
  /** Frequent small wins, capped top-end */
  low: {
    hitRate: 0.3,
    ladder: [
      { p: 0.6, multiplier: 1.6 },
      { p: 0.3, multiplier: 4.0 },
      { p: 0.09, multiplier: 10 },
      { p: 0.01, multiplier: 40 },
    ],
  },
  /** The workhorse slot shape */
  medium: {
    hitRate: 0.22,
    ladder: [
      { p: 0.55, multiplier: 1.8 },
      { p: 0.3, multiplier: 4.5 },
      { p: 0.12, multiplier: 12 },
      { p: 0.025, multiplier: 45 },
      { p: 0.005, multiplier: 180 },
    ],
  },
  /** Rare hits, long tail */
  high: {
    hitRate: 0.15,
    ladder: [
      { p: 0.5, multiplier: 2.2 },
      { p: 0.3, multiplier: 6 },
      { p: 0.15, multiplier: 15 },
      { p: 0.04, multiplier: 70 },
      { p: 0.009, multiplier: 350 },
      { p: 0.001, multiplier: 2500 },
    ],
  },
};

/** Ladder scaled so E[return per unit staked] = rtp exactly. */
export function scaledLadder(
  volatility: SlotVolatility,
  rtp: number
): { hitRate: number; steps: LadderStep[] } {
  const preset = VOLATILITY_PRESETS[volatility];
  const eHit = preset.ladder.reduce((a, s) => a + s.p * s.multiplier, 0);
  const scale = rtp / (preset.hitRate * eHit);
  return {
    hitRate: preset.hitRate,
    steps: preset.ladder.map((s) => ({ p: s.p, multiplier: s.multiplier * scale })),
  };
}

/** Exact by construction - exported so the calibration is a test surface. */
export function expectedSpinReturn(volatility: SlotVolatility, rtp: number): number {
  const { hitRate, steps } = scaledLadder(volatility, rtp);
  return hitRate * steps.reduce((a, s) => a + s.p * s.multiplier, 0);
}

/** Standard mulberry32 - tiny, fast, deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CasinoSimInput {
  bonusAmount: number;
  wageringMultiplier: number;
  /** 1 − RTP, as in casino-ev.ts */
  houseEdge: number;
  /** (0, 1]; defaults to 1 */
  contributionPct?: number;
  volatility: SlotVolatility;
  /** £ per spin; defaults to bonus/50 (min 10p) */
  spinStake?: number;
  runs?: number;
  seed?: number;
}

export interface CasinoSimResult {
  runs: number;
  /** Fraction of runs ending at £0 */
  bustPct: number;
  median: number;
  p10: number;
  p90: number;
  /** Mean £ retained across runs (same units as casinoOfferEv().ev) */
  meanEv: number;
  /** Mean £ cycled per run - meanEv ≡ bonus − edge × meanStaked */
  meanStaked: number;
  /** The H2 analytic figure for the same inputs, for honest side-by-side */
  analyticEv: number;
  histogram: { edges: number[]; counts: number[] };
}

const BUST_EPSILON = 0.01;
const HISTOGRAM_BUCKETS = 20;

interface SessionParams {
  bonus: number;
  requirement: number;
  contribution: number;
  spinStake: number;
  hitRate: number;
  /** Cumulative conditional probabilities aligned with multipliers */
  cumP: number[];
  multipliers: number[];
}

/** One full wagering session; returns the retained balance and £ staked. */
function runSession(params: SessionParams, rng: () => number): { final: number; staked: number } {
  let balance = params.bonus;
  let remaining = params.requirement;
  let staked = 0;
  while (remaining > 0 && balance >= BUST_EPSILON) {
    const stake = Math.min(params.spinStake, balance);
    staked += stake;
    remaining -= stake * params.contribution;
    balance -= stake;
    if (rng() < params.hitRate) {
      const roll = rng();
      let i = 0;
      while (i < params.cumP.length - 1 && roll >= params.cumP[i]) i++;
      balance += stake * params.multipliers[i];
    }
  }
  return { final: balance < BUST_EPSILON ? 0 : balance, staked };
}

function sessionParams(input: CasinoSimInput): SessionParams | null {
  const bonus = input.bonusAmount;
  if (!Number.isFinite(bonus) || bonus <= 0) return null;
  const contribution = Math.min(1, Math.max(0.01, input.contributionPct ?? 1));
  const spinStake = input.spinStake ?? Math.max(0.1, bonus / 50);
  if (!(spinStake > 0)) return null;
  const rtp = 1 - Math.min(1, Math.max(0, input.houseEdge));
  const { hitRate, steps } = scaledLadder(input.volatility, rtp);
  const cumP: number[] = [];
  let acc = 0;
  for (const s of steps) {
    acc += s.p;
    cumP.push(acc);
  }
  return {
    bonus,
    requirement: Math.max(0, input.wageringMultiplier) * bonus,
    contribution,
    spinStake,
    hitRate,
    cumP,
    multipliers: steps.map((s) => s.multiplier),
  };
}

/**
 * Run `count` sessions into `finals`, returning total £ staked. The UI
 * chunks by calling this repeatedly with the SAME rng so the main thread
 * never blocks; tests go through simulateWagering.
 */
export function simulateFinals(
  params: SessionParams,
  count: number,
  rng: () => number,
  finals: number[]
): number {
  let staked = 0;
  for (let i = 0; i < count; i++) {
    const r = runSession(params, rng);
    finals.push(r.final);
    staked += r.staked;
  }
  return staked;
}

export function summariseFinals(
  finals: number[],
  totalStaked: number,
  input: CasinoSimInput
): CasinoSimResult {
  const n = finals.length;
  const sorted = [...finals].sort((a, b) => a - b);
  const q = (frac: number) => sorted[Math.min(n - 1, Math.floor(frac * (n - 1)))];
  const mean = finals.reduce((a, b) => a + b, 0) / n;
  const busts = finals.reduce((a, b) => a + (b === 0 ? 1 : 0), 0);

  // Buckets sized to the bulk of the distribution (p99), overflow clipped
  // into the top bucket so jackpot tails can't flatten the chart.
  const hi = Math.max(q(0.99) * 1.1, input.bonusAmount, 1);
  const width = hi / HISTOGRAM_BUCKETS;
  const counts = new Array<number>(HISTOGRAM_BUCKETS).fill(0);
  for (const f of finals) {
    counts[Math.min(HISTOGRAM_BUCKETS - 1, Math.floor(f / width))]++;
  }
  const edges = Array.from({ length: HISTOGRAM_BUCKETS + 1 }, (_, i) => roundPence(i * width));

  // Delegate - NEVER reimplement casinoOfferEv (its staged pence-rounding
  // differs from a single terminal round by 1p on real inputs; the H2
  // verdict card and this dialog must always show the same figure).
  const analyticEv = casinoOfferEv({
    bonusAmount: input.bonusAmount,
    wageringMultiplier: input.wageringMultiplier,
    houseEdge: input.houseEdge,
    contributionPct: input.contributionPct,
  }).ev;

  return {
    runs: n,
    bustPct: busts / n,
    median: roundPence(q(0.5)),
    p10: roundPence(q(0.1)),
    p90: roundPence(q(0.9)),
    meanEv: roundPence(mean),
    meanStaked: roundPence(totalStaked / n),
    analyticEv,
    histogram: { edges, counts },
  };
}

export function simulateWagering(input: CasinoSimInput): CasinoSimResult | null {
  const runs = input.runs ?? 10_000;
  if (!Number.isFinite(runs) || runs <= 0) return null;
  const params = sessionParams(input);
  if (!params) return null;
  const rng = mulberry32(input.seed ?? 1);
  const finals: number[] = [];
  const staked = simulateFinals(params, runs, rng, finals);
  return summariseFinals(finals, staked, input);
}

/** Exposed for the chunked UI runner. */
export function casinoSimSession(input: CasinoSimInput): SessionParams | null {
  return sessionParams(input);
}
