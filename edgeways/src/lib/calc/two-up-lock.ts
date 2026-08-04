/**
 * 2UP lock-in maths (B6). Once the bookie pays early at two goals up, the
 * position is: bookie profit banked + the original exchange lay still live.
 * Backing the selection in-play (at the exchange, commission on winnings)
 * equalises the win / not-win outcomes exactly:
 *
 *   banked   = backStake × (backOdds − 1)
 *   ifWin    = banked − layStake × (layOdds − 1)
 *   ifNotWin = banked + layStake × (1 − c)
 *   stake s  = (ifNotWin − ifWin) / (1 + (B − 1)(1 − c))   at back odds B
 *   locked   = ifNotWin − s
 *
 * B comes from the live model's win probability (fair odds 1/p).
 */

import { roundPence } from "@/lib/calc/money";

export interface TwoUpLockInput {
  backStake: number;
  backOdds: number;
  layStake: number;
  layOdds: number;
  commission: number;
  /** Live model probability that the selection wins from here (0..1 exclusive) */
  liveWinProb: number;
}

export interface TwoUpLockSuggestion {
  /** Fair in-play back odds implied by the live model */
  fairBackOdds: number;
  /** Exchange back stake that equalises both outcomes (0 = nothing to do) */
  backStake: number;
  /** Guaranteed profit either way after the lock */
  lockedProfit: number;
  /** Position if left unhedged and the selection wins */
  ifWinUnhedged: number;
  /** Position if left unhedged and the selection does not win */
  ifNotWinUnhedged: number;
}

export function suggestTwoUpLock(input: TwoUpLockInput): TwoUpLockSuggestion | null {
  const { backStake, backOdds, layStake, layOdds, commission, liveWinProb } = input;
  if (!Number.isFinite(liveWinProb) || liveWinProb <= 0 || liveWinProb >= 1) return null;
  if (!(backStake > 0) || !(backOdds > 1)) return null;

  const banked = backStake * (backOdds - 1);
  const ifWin = banked - layStake * (layOdds - 1);
  const ifNotWin = banked + layStake * (1 - commission);

  const fairBackOdds = 1 / liveWinProb;
  const spread = ifNotWin - ifWin; // = layStake × (layOdds − c); 0 when no lay
  const stake = spread / (1 + (fairBackOdds - 1) * (1 - commission));
  const locked = ifNotWin - stake;

  return {
    fairBackOdds,
    backStake: roundPence(stake),
    lockedProfit: roundPence(locked),
    ifWinUnhedged: ifWin,
    ifNotWinUnhedged: ifNotWin,
  };
}
