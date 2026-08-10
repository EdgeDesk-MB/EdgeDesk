/**
 * Bet Builder Desk hedges via a separate whole lay_only bet (or deliberate
 * no lay), never bets.layStake on the qualifying back. Tracker helpers must
 * recognise that.
 */

import type { BetRow } from "@/lib/db/schema";

/** Qualifying / free-bet convert back created by Bet Builder Desk. */
export function isBetBuilderDeskBack(
  bet: Pick<BetRow, "label" | "notes" | "betType">
): boolean {
  if (!(bet.label.startsWith("BB ·") || bet.label.startsWith("BB FB ·"))) return false;
  return bet.notes?.includes("Bet Builder desk") ?? false;
}

/** Whole-ticket lay created by Bet Builder Desk. */
export function isBetBuilderDeskLay(bet: Pick<BetRow, "label" | "betType">): boolean {
  return bet.betType === "lay_only" && bet.label.startsWith("BB lay");
}
