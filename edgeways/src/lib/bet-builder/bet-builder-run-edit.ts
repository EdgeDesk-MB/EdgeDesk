import type { BetBuilderRunRow, BetBuilderSelectionRow } from "@/lib/db/schema";

/** True when stake/odds/selection structure must stay locked. */
export function betBuilderRunMoneyLocked(
  run: BetBuilderRunRow,
  selections: BetBuilderSelectionRow[]
): boolean {
  if (run.status !== "active") return true;
  if (run.wholeLayBetId != null) return true;
  return selections.some((s) => s.result !== "pending");
}
