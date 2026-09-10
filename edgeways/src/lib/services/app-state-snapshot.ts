/**
 * Desk poll helper: skip React work when /api/state echoed the same snapshot.
 * Key order is stable because both sides come from the same mapper.
 */
export function jsonSnapshotUnchanged(
  previous: unknown,
  next: unknown
): boolean {
  if (previous == null) return false;
  return JSON.stringify(previous) === JSON.stringify(next);
}
