/**
 * Open-bet valuation for platform P&L.
 *
 * Matched bets store worst-case guaranteed profit as `expectedProfit` at placement.
 * Until settlement (or a live in-play revaluation), that worst case is the
 * provisional contribution to running profit.
 */
import type { BetRow } from "@/lib/db/schema";

/** Worst-case / planned profit for an open bet (null if unknown). */
export function openBetExpectedProfit(
  bet: Pick<BetRow, "status" | "expectedProfit">
): number | null {
  if (bet.status !== "open") return null;
  if (bet.expectedProfit == null || Number.isNaN(bet.expectedProfit)) return null;
  return bet.expectedProfit;
}

/**
 * Sum worst-case expected profit across open bets.
 * Optionally exclude bet ids already valued via live provisional (avoid double-count).
 */
export function sumOpenExpectedProfit(
  bets: Array<Pick<BetRow, "id" | "status" | "expectedProfit">>,
  opts?: { excludeBetIds?: Iterable<number> }
): number {
  const exclude = opts?.excludeBetIds ? new Set(opts.excludeBetIds) : null;
  let total = 0;
  for (const bet of bets) {
    if (exclude?.has(bet.id)) continue;
    const value = openBetExpectedProfit(bet);
    if (value != null) total += value;
  }
  return Math.round(total * 100) / 100;
}
