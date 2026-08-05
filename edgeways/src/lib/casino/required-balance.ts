/**
 * Cash required for a casino campaign: first qualifying_wager with amount > 0
 * (sorted by sortOrder). Components have no per-step status.
 */
export function casinoRequiredBalance(
  components: Array<{
    componentType: string;
    amount: number | null;
    sortOrder: number;
  }>
): number | null {
  const qws = components
    .filter((c) => c.componentType === "qualifying_wager")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const c of qws) {
    if (typeof c.amount === "number" && c.amount > 0) return c.amount;
  }
  return null;
}
