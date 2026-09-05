/**
 * 2UP both-win P&L for Tracker stakes: bookie pays early and the lay also
 * wins (e.g. 2-2 after the selection led by two). Uses the existing twoUp
 * windfall, with the bet's actual lay stake.
 */
import { twoUp } from "@/lib/calc/twoup";

export function twoUpBothWinProfit(bet: {
  earlyPayout?: number | boolean | null;
  backStake: number;
  backOdds: number;
  layStake: number;
  layOdds: number;
  commission: number;
}): number | null {
  if (!bet.earlyPayout) return null;
  if (!(bet.backStake > 0) || !(bet.backOdds > 1)) return null;
  if (!(bet.layStake > 0) || !(bet.layOdds > 1)) return null;
  return twoUp({
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layOdds: bet.layOdds,
    commission: bet.commission,
    layStakeOverride: bet.layStake,
  }).windfallProfit;
}
