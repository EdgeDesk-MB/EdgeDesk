/**
 * 2UP both-win P&L for Tracker stakes: bookie pays early and the lay also
 * wins (e.g. 2-2 after the selection led by two). Uses the existing twoUp
 * windfall, with the bet's actual lay stake.
 */
import { decimalToFractional } from "@/lib/calc/odds";
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

/** Bookie as if the back paid, exchange as if the lay won. */
export function earlyPayoutBothWinSides(preview: {
  ifBackWins: { bookie: number };
  ifBackLoses: { exchange: number };
}): { bookie: number; exchange: number } {
  return {
    bookie: preview.ifBackWins.bookie,
    exchange: preview.ifBackLoses.exchange,
  };
}

/**
 * Fractional odds against £1 of qualifying cost. Cost is the matched loss
 * if early payout never lands; outcome is the 2UP both-win profit.
 */
export function twoUpOddsAgainstPound(
  expectedProfit: number | null | undefined,
  windfallProfit: number
): { decimal: number; against: string } | null {
  if (expectedProfit == null || !Number.isFinite(expectedProfit)) return null;
  if (!Number.isFinite(windfallProfit) || !(windfallProfit > 0)) return null;
  const cost = -expectedProfit;
  if (!(cost > 0.004)) return null;
  const profitPerPound = windfallProfit / cost;
  const decimal = 1 + profitPerPound;
  const against =
    profitPerPound >= 10
      ? `${profitPerPound.toFixed(1)}/1`
      : decimalToFractional(decimal);
  return { decimal, against };
}
