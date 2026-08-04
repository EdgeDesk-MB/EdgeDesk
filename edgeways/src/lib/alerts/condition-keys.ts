/**
 * Stateful alert keys that should be pulled down when the underlying
 * condition clears (offer claimed, lay added, race gone). One-shot kinds
 * like result_settled are excluded - they are history, not a live prompt.
 */

const CONDITION_PREFIXES = [
  "offer_expiring:",
  "naked_exposure:",
  "race_off_soon:",
  "two_up_lock:",
] as const;

export function isConditionAlertKey(key: string): boolean {
  return CONDITION_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Keys that were active last poll but are not in the current firing set. */
export function clearedConditionAlertKeys(
  previouslyActive: Iterable<string>,
  currentlyActive: Set<string>
): string[] {
  const cleared: string[] = [];
  for (const key of previouslyActive) {
    if (!key || currentlyActive.has(key)) continue;
    if (isConditionAlertKey(key)) cleared.push(key);
  }
  return cleared;
}
