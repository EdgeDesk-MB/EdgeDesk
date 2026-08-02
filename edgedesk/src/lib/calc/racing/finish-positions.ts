/**
 * Finishing-position probabilities for a horse race (Harville / Plackett-Luce).
 *
 * Given each runner's win probability, this returns the probability that runner
 * finishes 1st, 2nd, 3rd, 4th, and so on. The model draws finishers one at a
 * time without replacement, renormalising over whoever is left:
 *
 *   P(i finishes 2nd) = sum over j of  p_j * p_i/(1 - p_j)
 *
 * The 1/(1 - p_j) term is why a dominant favourite lifts every other runner's
 * chance of finishing second, and why a field that thins out after the fourth
 * favourite concentrates the top-four probability mass. Field size falls out of
 * the same arithmetic, though less dramatically than a naive places-over-runners
 * count suggests: a 12% runner hits the top four about 37% of the time in an
 * eight-runner field against about 31% in a sixteen-runner one.
 *
 * Probabilities only - no money is computed here. Callers converting these into
 * pounds must use `roundPence` from `src/lib/calc/money.ts`.
 */

import { noVig, trueProbabilityFromExchange } from "@/lib/calc/ev";

/** Positions the model computes by default (a place refund usually pays to 4th). */
export const DEFAULT_MAX_POSITION = 4;

/** Minimum share of the field that must be priced before the model is trusted. */
export const DEFAULT_MIN_COVERAGE = 0.9;

/**
 * Ceiling on enumeration steps for one race.
 *
 * Exact enumeration is factorial in the requested depth, so a deep target on a big
 * field has to be refused rather than approximated. A 12-runner field to 6th costs
 * about 774k steps and passes; a 16-runner field to 6th costs 6.3m and does not.
 */
export const ENUMERATION_BUDGET = 2_000_000;

/**
 * Deepest position anyone may ask for.
 *
 * The budget bounds the enumeration but not the allocation, which is sized to the
 * request so callers always get back the columns they asked for. No real race pays
 * anywhere near this deep, and stored offer rules are cast from JSON without
 * validation, so an absurd request is refused rather than allowed to allocate.
 */
export const MAX_REQUESTED_POSITION = 24;

export interface FinishPositionProbs {
  /** `byRunner[runnerIndex][position - 1]` - probability of that exact finishing position. */
  byRunner: number[][];
  /** How many positions were computed. Always the full depth requested. */
  maxPosition: number;
}

export interface FinishPositionOptions {
  /** How many finishing positions to compute. Defaults to 4. */
  maxPosition?: number;
  /**
   * Stern exponent for positions after the winner. 1 is pure Harville and is the
   * shipped default. Values below 1 shift place probability from short prices
   * towards longshots, correcting Harville's documented favourite bias. Left at 1
   * until it can be calibrated against real settled results rather than guessed.
   */
  exponent?: number;
  /** Override the enumeration ceiling. Tests only. */
  budget?: number;
}

/** Guards against floating-point drift leaving a zero or negative denominator. */
const MIN_REMAINING = 1e-12;

/** Enumeration steps needed for `maxPosition` places in an `n`-runner field. */
export function enumerationCost(n: number, maxPosition: number): number {
  let cost = 0;
  let tuples = 1;
  for (let depth = 0; depth < maxPosition; depth += 1) {
    tuples *= Math.max(n - depth, 0);
    cost += tuples;
  }
  return cost;
}

/**
 * Probability that each runner finishes in each position, under Harville with an
 * optional Stern exponent on the positions after the winner.
 *
 * Exact enumeration, not simulation: it walks every ordered tuple of finishers
 * down to the requested depth, renormalising over whoever is left at each step.
 *
 * Returns `null` when the requested depth would cost more than `ENUMERATION_BUDGET`
 * steps. Refusing is deliberate - silently computing fewer positions than asked for
 * would understate the trigger probability of an offer that pays past 4th while
 * still presenting itself as a full model result.
 */
export function finishPositionProbs(
  winProbs: number[],
  opts?: FinishPositionOptions
): FinishPositionProbs | null {
  const n = winProbs.length;
  const requested = Math.max(1, Math.floor(opts?.maxPosition ?? DEFAULT_MAX_POSITION));
  if (requested > MAX_REQUESTED_POSITION) return null;
  // Nobody finishes 9th in an eight-runner race, so depth beyond the field is free.
  const maxPosition = Math.max(1, Math.min(requested, Math.max(n, 1)));
  const exponent = opts?.exponent ?? 1;

  if (enumerationCost(n, maxPosition) > (opts?.budget ?? ENUMERATION_BUDGET)) return null;

  const byRunner: number[][] = Array.from({ length: n }, () =>
    new Array<number>(requested).fill(0)
  );
  if (n === 0) return { byRunner, maxPosition: requested };

  // Position 1 always uses the raw market probabilities, so the model reproduces
  // the book exactly where the book is most informative. The exponent applies only
  // to the draws after the winner.
  const total = winProbs.reduce((a, b) => a + b, 0);
  const p = total > 0 ? winProbs.map((w) => w / total) : winProbs.map(() => 1 / n);
  const weight = exponent === 1 ? p : p.map((v) => Math.pow(v, exponent));
  const weightTotal = weight.reduce((a, b) => a + b, 0);

  const used = new Array<boolean>(n).fill(false);

  function walk(depth: number, prob: number, remaining: number): void {
    if (remaining <= MIN_REMAINING) return;
    const last = depth === maxPosition - 1;
    for (let i = 0; i < n; i += 1) {
      if (used[i]) continue;
      const step = prob * (weight[i] / remaining);
      if (step <= 0) continue;
      byRunner[i][depth] += step;
      if (last) continue;
      used[i] = true;
      walk(depth + 1, step, remaining - weight[i]);
      used[i] = false;
    }
  }

  for (let a = 0; a < n; a += 1) {
    byRunner[a][0] += p[a];
    if (maxPosition === 1 || p[a] <= 0) continue;
    used[a] = true;
    walk(1, p[a], weightTotal - weight[a]);
    used[a] = false;
  }

  return { byRunner, maxPosition: requested };
}

/** Sum of a runner's probabilities across the given finishing positions. */
export function sumPositions(runnerProbs: number[], positions: number[]): number {
  let total = 0;
  for (const position of positions) {
    const value = runnerProbs[position - 1];
    if (value != null) total += value;
  }
  return Math.max(0, Math.min(1, total));
}

export interface PriceableRunner {
  /** Best exchange back price, when the feed returns both sides of the book. */
  exchangeBackDecimal?: number | null;
  /** Best exchange lay price. */
  exchangeDecimal?: number | null;
  nonRunner?: boolean;
}

export interface WinProbsResult {
  /** Normalised win probabilities, aligned with `indexes`. */
  probs: number[];
  /** Index into the original runner array for each entry in `probs`. */
  indexes: number[];
  /** Overround of the raw book before normalising. Negative when the book is underround. */
  overroundPct: number;
  /** Share of active runners that carried a usable price. */
  coverage: number;
  /**
   * Share of the priced runners that had both sides of the book. A one-sided
   * price is skewed - `1/lay` understates and `1/back` overstates - so a book
   * built largely from single sides is biased in a way normalising cannot undo.
   */
  twoSidedShare: number;
}

/**
 * Derive normalised win probabilities from the exchange book.
 *
 * Uses the back/lay midpoint when both sides are available (the sharpest public
 * estimate of fair value), falling back to the lay price alone. Returns null when
 * too little of the field is priced, because a partial book normalises to
 * nonsense - the same reasoning behind the 80% guard in `racing/fair-odds.ts`.
 */
export function winProbsFromRunners(
  runners: PriceableRunner[],
  opts?: { minCoverage?: number }
): WinProbsResult | null {
  const minCoverage = opts?.minCoverage ?? DEFAULT_MIN_COVERAGE;

  const activeIndexes: number[] = [];
  runners.forEach((runner, index) => {
    if (!runner.nonRunner) activeIndexes.push(index);
  });
  if (activeIndexes.length === 0) return null;

  const indexes: number[] = [];
  const impliedOdds: number[] = [];
  let twoSided = 0;

  for (const index of activeIndexes) {
    const runner = runners[index];
    const lay = runner.exchangeDecimal;
    const back = runner.exchangeBackDecimal;

    let probability: number | null = null;
    let bothSides = false;
    if (back != null && back > 1 && lay != null && lay > 1) {
      probability = trueProbabilityFromExchange(back, lay);
      bothSides = true;
    } else if (lay != null && lay > 1) {
      probability = 1 / lay;
    } else if (back != null && back > 1) {
      probability = 1 / back;
    }

    if (probability == null || probability <= 0) continue;
    indexes.push(index);
    impliedOdds.push(1 / probability);
    if (bothSides) twoSided += 1;
  }

  const coverage = indexes.length / activeIndexes.length;
  if (coverage < minCoverage || indexes.length < 2) return null;

  // noVig divides by the implied sum, so it handles an underround book (a lay-only
  // book can sum below 1) as happily as an overround one.
  const { fairProbabilities, overroundPct } = noVig(impliedOdds);

  return {
    probs: fairProbabilities,
    indexes,
    overroundPct,
    coverage,
    twoSidedShare: twoSided / indexes.length,
  };
}
