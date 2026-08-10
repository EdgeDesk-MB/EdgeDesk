/**
 * Systems Desk backs are deliberate no-lay full-cover tickets.
 * Exclude from unlayed / naked-exposure queues.
 */

import type { BetRow } from "@/lib/db/schema";

export function isSystemsDeskBack(
  bet: Pick<BetRow, "notes" | "betType">
): boolean {
  return bet.notes?.includes("Systems desk") ?? false;
}
