import type { AccaLegRow, AccaRunRow } from "@/lib/db/schema";

/** True when stake/odds/leg structure must stay locked (lays or results already exist). */
export function accaRunMoneyLocked(run: AccaRunRow, legs: AccaLegRow[]): boolean {
  if (run.status !== "active") return true;
  if (run.wholeLayBetId != null) return true;
  // layStake != null covers real lays and deliberate £0 no-lay.
  return legs.some((l) => l.layStake != null || l.result !== "pending");
}
