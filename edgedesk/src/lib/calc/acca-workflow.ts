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
