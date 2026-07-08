/**
 * Core matched betting (back/lay) calculator.
 * Commission `c` is the exchange commission rate (e.g. 0.02) charged on lay winnings.
 */

import { roundPence } from "./money";

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

export function optimalLayStake(input: Omit<MatchedInput, "layStakeOverride">): number {
  const { mode, backStake, backOdds, layOdds, commission } = input;
  const denom = layOdds - commission;
  if (denom <= 0) return 0;
  switch (mode) {
    case "qualifying":
    case "free_sr":
      return (backStake * backOdds) / denom;
    case "free_snr":
      return (backStake * (backOdds - 1)) / denom;
    case "risk_free": {
      const refund = (input.refundAmount ?? backStake) * (input.refundRetention ?? 0.7);
      return (backStake * backOdds - refund) / denom;
    }
  }
}

export function matchedBet(input: MatchedInput): MatchedResult {
  const { mode, backStake, backOdds, layOdds, commission } = input;
  const layStake = roundPence(input.layStakeOverride ?? optimalLayStake(input));
  const liability = layStake * (layOdds - 1);
  const layWinnings = layStake * (1 - commission);

  let profitIfBackWins: number;
  let profitIfLayWins: number;

  switch (mode) {
    case "qualifying":
      profitIfBackWins = backStake * (backOdds - 1) - liability;
      profitIfLayWins = layWinnings - backStake;
      break;
    case "free_snr":
      profitIfBackWins = backStake * (backOdds - 1) - liability;
      profitIfLayWins = layWinnings;
      break;
    case "free_sr":
      profitIfBackWins = backStake * backOdds - liability;
      profitIfLayWins = layWinnings;
      break;
    case "risk_free": {
      const refund = (input.refundAmount ?? backStake) * (input.refundRetention ?? 0.7);
      profitIfBackWins = backStake * (backOdds - 1) - liability;
      profitIfLayWins = layWinnings - backStake + refund;
      break;
    }
  }

  const guaranteed = Math.min(profitIfBackWins, profitIfLayWins);
  const base = mode === "qualifying" || mode === "risk_free" ? backStake : backStake;
  return {
    layStake,
    liability,
    profitIfBackWins,
    profitIfLayWins,
    guaranteed,
    qualifyingLossPct: base > 0 ? guaranteed / base : 0,
  };
}
