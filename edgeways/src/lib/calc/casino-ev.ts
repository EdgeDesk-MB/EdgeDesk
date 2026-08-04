/**
 * Casino wagering-EV maths (H2) - the variance-honest counterpart to the
 * matched engine. EV here is an EXPECTATION across many attempts, never a
 * lock: a single session's outcome is dominated by variance, which is why
 * every verdict carries a variance tier alongside the £ figure.
 *
 * Model: completing wagering means cycling `bonus × multiplier` through a
 * game whose house edge taxes every spin. Games contributing less than 100%
 * to wagering inflate the effective turnover (and with it the drag).
 */

import { roundPence } from "@/lib/calc/money";

/** Heuristic slot default. Callers must mark EV derived from it as "heuristic" (A2 rule). */
export const DEFAULT_RTP = 0.96;

/** House edge is the complement of RTP, clamped to a sane [0, 1]. */
export function houseEdgeFromRtp(rtp: number): number {
  if (!Number.isFinite(rtp)) return 1 - DEFAULT_RTP;
  return Math.min(1, Math.max(0, 1 - rtp));
}

function clampContribution(pct: number | undefined): number {
  if (pct == null || !Number.isFinite(pct)) return 1;
  return Math.min(1, Math.max(0.01, pct));
}

export interface CasinoEvInput {
  /** Bonus face value in £ */
  bonusAmount: number;
  /** Playthrough requirement, e.g. 35 for "35×" (0 = cash, no wagering) */
  wageringMultiplier: number;
  /** 1 − RTP, e.g. 0.04 for a 96% RTP slot */
  houseEdge: number;
  /** Game weighting towards wagering, (0, 1]; defaults to 1 (100%) */
  contributionPct?: number;
}

export interface CasinoEvResult {
  /** Expected £ retained after completing wagering (bonus − drag) */
  ev: number;
  /** Expected £ lost to the house edge across the required turnover */
  wageringDrag: number;
  /** £ that must be cycled through the game (contribution-adjusted) */
  totalTurnover: number;
}

export function casinoOfferEv(input: CasinoEvInput): CasinoEvResult {
  const bonus = input.bonusAmount;
  if (!Number.isFinite(bonus) || bonus <= 0) {
    return { ev: 0, wageringDrag: 0, totalTurnover: 0 };
  }
  const multiplier = Math.max(0, input.wageringMultiplier);
  const edge = Math.min(1, Math.max(0, input.houseEdge));
  const contribution = clampContribution(input.contributionPct);

  const totalTurnover = roundPence((bonus * multiplier) / contribution);
  const wageringDrag = roundPence(totalTurnover * edge);
  return {
    ev: roundPence(bonus - wageringDrag),
    wageringDrag,
    totalTurnover,
  };
}

export type CasinoVarianceTier = "low" | "medium" | "high";

/**
 * Bust-risk banding from the effective turnover ratio (multiplier ÷
 * contribution): the more turnover a bonus must survive, the more bimodal
 * the outcome. A heavy house edge (≥ 6%) drains the balance faster mid-
 * wagering, so it bumps the tier one step.
 */
export function varianceTier(input: {
  wageringMultiplier: number;
  houseEdge: number;
  contributionPct?: number;
}): CasinoVarianceTier {
  const ratio = Math.max(0, input.wageringMultiplier) / clampContribution(input.contributionPct);
  let tier: CasinoVarianceTier = ratio <= 10 ? "low" : ratio <= 40 ? "medium" : "high";
  if (input.houseEdge >= 0.06 && tier !== "high") {
    tier = tier === "low" ? "medium" : "high";
  }
  return tier;
}

/** Honest one-liner for the verdict card - EV framed as expectation, never a lock. */
export function varianceTierCopy(tier: CasinoVarianceTier): string {
  switch (tier) {
    case "low":
      return "Low variance: most attempts land near the EV.";
    case "medium":
      return "Medium variance: expect a wide spread around the EV.";
    case "high":
      return "High variance: most sessions lose; the EV only shows up across many attempts.";
  }
}
