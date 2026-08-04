/**
 * Acca desk workflow maths (J7) - pure per-leg stakes for running an acca
 * as a guided multi-day workflow. Consumes the same conventions as
 * accumulator.ts (which owns full acca STRUCTURE maths); this module owns
 * the SEQUENTIAL execution recursion. The EP engine is not touched.
 *
 * Sequential ("cover") method: each leg is laid so that if it loses - the
 * acca dies - the exchange win exactly covers the acca stake plus every
 * liability already paid on earlier winning legs. £0 on any leg loss; the
 * all-win outcome carries whatever remains. The FINAL leg is instead
 * equalised (lock-in algebra) so the run ends with the same £ either way.
 *
 * Acca insurance reuses both shapes: leg-by-leg insurance is the same
 * cover recursion (the run stops at the first loss and the refund takes
 * over); whole-acca insurance is one standard equalising lay at the
 * combined price. Which to use is picked per run (Sam - both in v1).
 */

import { roundPence } from "./money";

/** Lay-due lead window (Sam: previous result in + kick-off within 30 min). */
export const DEFAULT_LAY_LEAD_MINUTES = 30;
/** A leg more than this far past kick-off is no longer actionable. */
export const LAY_DUE_EXPIRY_MS = 60 * 60_000;

export interface SequentialLayInput {
  accaStake: number;
  /** Σ layStake × (layOdds − 1) across earlier LAID legs that WON */
  priorLiabilities: number;
  /** Exchange commission as a fraction */
  commission: number;
}

/**
 * Zero-loss cover stake for the next leg: L(1−c) = stake + prior
 * liabilities. Lay odds don't change the cover stake - only the liability
 * this leg rolls forward if it wins.
 */
export function nextSequentialLay(input: SequentialLayInput): number | null {
  const { accaStake, priorLiabilities, commission: c } = input;
  if (!(accaStake > 0) || !(priorLiabilities >= 0) || !(c >= 0 && c < 1)) return null;
  return roundPence((accaStake + priorLiabilities) / (1 - c));
}

export interface FinalLegLockInput {
  accaStake: number;
  /** Product of every leg's bookie odds (void legs excluded) */
  combinedBackOdds: number;
  priorLiabilities: number;
  legLayOdds: number;
  commission: number;
}

export interface FinalLegLock {
  layStake: number;
  lockedIfWin: number;
  lockedIfLose: number;
}

/** Equalise the last leg: the run ends with the same £ either way. */
export function finalLegLockLay(input: FinalLegLockInput): FinalLegLock | null {
  const { accaStake, combinedBackOdds, priorLiabilities, legLayOdds, commission: c } = input;
  if (!(accaStake > 0) || !(combinedBackOdds > 1) || !(legLayOdds > 1)) return null;
  if (!(priorLiabilities >= 0) || !(c >= 0 && c < 1)) return null;

  const win0 = accaStake * (combinedBackOdds - 1) - priorLiabilities;
  const lose0 = -(accaStake + priorLiabilities);
  const layStake = roundPence((win0 - lose0) / (legLayOdds - c));
  return {
    layStake,
    lockedIfWin: win0 - layStake * (legLayOdds - 1),
    lockedIfLose: lose0 + layStake * (1 - c),
  };
}

export interface WholeAccaLayInput {
  stake: number;
  combinedOdds: number;
  layOdds: number;
  commission: number;
}

export interface WholeAccaLay {
  layStake: number;
  profitIfAllWin: number;
  profitIfAnyLose: number;
}

/**
 * Insurance laid once: a standard equalising lay of the whole acca at the
 * combined exchange price (same algebra as a matched qualifying lay).
 */
export function wholeAccaLay(input: WholeAccaLayInput): WholeAccaLay | null {
  const { stake, combinedOdds, layOdds, commission: c } = input;
  if (!(stake > 0) || !(combinedOdds > 1) || !(layOdds > 1) || !(c >= 0 && c < 1)) return null;
  const layStake = roundPence((stake * combinedOdds) / (layOdds - c));
  return {
    layStake,
    profitIfAllWin: stake * (combinedOdds - 1) - layStake * (layOdds - 1),
    profitIfAnyLose: -stake + layStake * (1 - c),
  };
}

export interface LegLiabilityLike {
  result: "pending" | "won" | "lost" | "void";
  layStake: number | null;
  layOdds: number | null;
}

/**
 * Rolling ledger: liabilities are PAID only when a laid leg wins. Void
 * legs return the lay; pending legs haven't settled; unlaid legs cost
 * nothing.
 */
export function priorLayLiabilities(legs: LegLiabilityLike[]): number {
  return legs
    .filter((l) => l.result === "won" && l.layStake != null && (l.layOdds ?? 0) > 1)
    .reduce((a, l) => a + (l.layStake ?? 0) * ((l.layOdds ?? 1) - 1), 0);
}

export interface AccaProfitLeg extends LegLiabilityLike {
  backOdds: number;
}

export interface AccaProfitRun {
  stake: number;
  commission: number;
  /** insurance_whole only - the single combined lay across every leg */
  wholeLayStake?: number | null;
  wholeLayOdds?: number | null;
  /** Bookmaker acca boost %, winnings-only convention - see applyAccaBoost */
  boostPct?: number | null;
}

/**
 * Realised campaign P&L to date - mirrors the exact settlement branches in
 * acca-desk.ts (setLegResult/completeRun) so the desk can show a live
 * figure without waiting for the run to finish:
 *  - each laid leg settles the moment IT does (won leg -> lay lost, a
 *    liability paid; lost leg -> lay won, stake kept minus commission);
 *  - the acca back bet (and insurance_whole's combined lay) settle the
 *    moment ANY leg is lost - nothing further is ever laid;
 *  - otherwise, once every leg has resolved without a loss, the back bet
 *    wins at the combined odds (or voids if every leg voided).
 * A run with no loss and a pending leg still open therefore contributes
 * £0 for the still-open back bet - this is a REALISED figure, not a
 * probability-weighted projection.
 */
export function accaCampaignProfit(run: AccaProfitRun, legs: AccaProfitLeg[]): number {
  // Each contribution is rounded to the penny as it's added - matching
  // settleLinkedBet's per-bet roundPence in acca-desk.ts exactly, so this
  // never drifts a penny from the real bets ledger it mirrors.
  let total = 0;
  for (const leg of legs) {
    if (leg.layStake == null || leg.layOdds == null) continue;
    if (leg.result === "won") total -= roundPence(leg.layStake * (leg.layOdds - 1));
    else if (leg.result === "lost") total += roundPence(leg.layStake * (1 - run.commission));
  }

  const anyLost = legs.some((l) => l.result === "lost");
  const allResolved = legs.length > 0 && legs.every((l) => l.result !== "pending");

  if (anyLost) {
    total -= run.stake;
    if (run.wholeLayStake != null && run.wholeLayOdds != null) {
      total += roundPence(run.wholeLayStake * (1 - run.commission));
    }
  } else if (allResolved) {
    const settled = legs.filter((l) => l.result !== "void");
    if (settled.length > 0) {
      const rawCombined = settled.reduce((a, l) => a * l.backOdds, 1);
      const combined = applyAccaBoost(rawCombined, run.boostPct);
      total += roundPence(run.stake * (combined - 1));
      if (run.wholeLayStake != null && run.wholeLayOdds != null) {
        total -= roundPence(run.wholeLayStake * (run.wholeLayOdds - 1));
      }
    }
    // every leg void: back bet (and whole lay) void too - contributes £0
  }

  return roundPence(total);
}

export interface AccaOutcomeLeg {
  backOdds: number;
  result: "pending" | "won" | "lost" | "void";
}

export interface AccaOutcomePercentages {
  /** Every leg wins (0-100) */
  allWinPct: number;
  /** Exactly one leg loses, every other wins (0-100) */
  oneLosePct: number;
  /** At least one leg loses - always 100 − allWinPct (0-100) */
  atLeastOneLosePct: number;
}

/**
 * ALL WIN / 1 LOSE / 1+ LOSE breakdown for the run card. Each leg's implied
 * probability is the NAIVE 1/backOdds (no market-wide prices exist for an
 * ad-hoc acca leg, so there's no no-vig fair price to fall back on) -
 * callers MUST render this behind a heuristic basis badge, never as a
 * measured probability. A settled leg is certain, not probabilistic: won
 * forces p=1, lost forces p=0, so the breakdown sharpens as the run plays
 * out. Void legs are excluded entirely, same convention as combinedBackOdds
 * in acca-desk.ts.
 */
export function accaOutcomePercentages(legs: AccaOutcomeLeg[]): AccaOutcomePercentages {
  const probs = legs
    .filter((l) => l.result !== "void")
    .map((l) => {
      if (l.result === "won") return 1;
      if (l.result === "lost") return 0;
      return l.backOdds > 1 ? 1 / l.backOdds : 0;
    });

  if (probs.length === 0) return { allWinPct: 0, oneLosePct: 0, atLeastOneLosePct: 0 };

  const allWin = probs.reduce((a, p) => a * p, 1);
  const oneLose = probs.reduce((sum, p_i, i) => {
    const others = probs.reduce((a, p, j) => (j === i ? a : a * p), 1);
    return sum + (1 - p_i) * others;
  }, 0);

  return {
    allWinPct: allWin * 100,
    oneLosePct: oneLose * 100,
    atLeastOneLosePct: (1 - allWin) * 100,
  };
}

/**
 * Apply a bookmaker acca boost to the raw combined (product-of-legs) odds.
 * WINNINGS-ONLY convention (Sam's call, 2026-07-22 - matches how boosts are
 * usually marketed, "your winnings boosted by X%"): only the profit portion
 * of the price is boosted, the stake-return £1 is not -
 *   boosted = 1 + (rawCombinedOdds − 1) × (1 + boostPct / 100)
 * A missing/zero/negative boostPct is the identity - returns rawCombinedOdds
 * unchanged, so an unboosted run's numbers never move.
 */
export function applyAccaBoost(rawCombinedOdds: number, boostPct: number | null | undefined): number {
  if (!(rawCombinedOdds > 1) || boostPct == null || !(boostPct > 0)) return rawCombinedOdds;
  return 1 + (rawCombinedOdds - 1) * (1 + boostPct / 100);
}
