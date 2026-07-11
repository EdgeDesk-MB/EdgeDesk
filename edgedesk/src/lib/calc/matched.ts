/**
 * Core matched betting (back/lay) calculator.
 * Commission `c` is the exchange commission rate (e.g. 0.02) charged on lay winnings.
 */

import { roundPence } from "./money";
import { applySpecialBonus, type SpecialBonus } from "./special-bonus";

export type BetMode = "qualifying" | "free_snr" | "free_sr" | "risk_free";

export interface MatchedInput {
  mode: BetMode;
  backStake: number;
  backOdds: number;
  layOdds: number;
  commission: number;
  /** risk_free only: refund amount (usually = backStake) */
  refundAmount?: number;
  /** risk_free only: what fraction of the refund you can extract as cash (e.g. 0.7 for a free-bet refund) */
  refundRetention?: number;
  /** Ultimatcher-style bookie bonus overlay (usually with qualifying) */
  specialBonus?: SpecialBonus;
  /** Optional lay stake override (overlay/underlay). If omitted, the optimal stake is used. */
  layStakeOverride?: number;
}

export interface MatchedResult {
  layStake: number;
  liability: number;
  profitIfBackWins: number;
  profitIfLayWins: number;
  /** Guaranteed profit at the optimal lay stake (min of the two outcomes) */
  guaranteed: number;
  /** Fraction of back stake (or free bet value) retained/lost */
  qualifyingLossPct: number;
}

/** Bookie-side P&L before any lay (shared with layplan). */
export function matchedBackReturns(input: {
  mode: BetMode;
  backStake: number;
  backOdds: number;
  refundAmount?: number;
  refundRetention?: number;
  specialBonus?: SpecialBonus;
}): { win: number; lose: number } {
  const { mode, backStake, backOdds } = input;
  let win: number;
  let lose: number;
  switch (mode) {
    case "qualifying":
      win = backStake * (backOdds - 1);
      lose = -backStake;
      break;
    case "free_snr":
      win = backStake * (backOdds - 1);
      lose = 0;
      break;
    case "free_sr":
      win = backStake * backOdds;
      lose = 0;
      break;
    case "risk_free": {
      const refund = (input.refundAmount ?? backStake) * (input.refundRetention ?? 0.7);
      win = backStake * (backOdds - 1);
      lose = -backStake + refund;
      break;
    }
  }
  return applySpecialBonus(win, lose, backStake, backOdds, input.specialBonus);
}

export function optimalLayStake(input: Omit<MatchedInput, "layStakeOverride">): number {
  const { layOdds, commission } = input;
  const denom = layOdds - commission;
  if (denom <= 0) return 0;
  const { win, lose } = matchedBackReturns(input);
  // Equalise: win - L(Ol-1) = lose + L(1-c)  →  L = (win - lose) / (Ol - c)
  return (win - lose) / denom;
}

export function matchedBet(input: MatchedInput): MatchedResult {
  const { backStake, layOdds, commission } = input;
  const layStake = roundPence(input.layStakeOverride ?? optimalLayStake(input));
  const liability = layStake * (layOdds - 1);
  const layWinnings = layStake * (1 - commission);
  const { win, lose } = matchedBackReturns(input);

  const profitIfBackWins = win - liability;
  const profitIfLayWins = lose + layWinnings;
  const guaranteed = Math.min(profitIfBackWins, profitIfLayWins);
  return {
    layStake,
    liability,
    profitIfBackWins,
    profitIfLayWins,
    guaranteed,
    qualifyingLossPct: backStake > 0 ? guaranteed / backStake : 0,
  };
}

