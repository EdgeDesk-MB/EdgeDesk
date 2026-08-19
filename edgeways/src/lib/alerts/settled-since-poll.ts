/**
 * Which settled bets the watcher should announce after a state poll.
 * First poll seeds silently. A thin later poll must not replay history.
 */

export const SETTLEMENT_ANNOUNCE_MAX_AGE_MS = 10 * 60_000;

export type SettledBetSnapshot = {
  id: number;
  status: string;
  settledAt: number | null;
};

export function resultSettledAlertKey(betId: number): string {
  return `result_settled:${betId}`;
}

export function resultSettledAlertKeys(betIds: Iterable<number>): string[] {
  return [...betIds].map(resultSettledAlertKey);
}

export function isRecentSettlement(
  settledAt: number | null,
  now: number,
  maxAgeMs: number = SETTLEMENT_ANNOUNCE_MAX_AGE_MS
): boolean {
  if (settledAt == null) return false;
  return now - settledAt <= maxAgeMs;
}

/**
 * Keep known settled ids across a thin poll. Only drop an id when this poll
 * positively shows that bet is open again.
 */
export function mergeSettledStatusMap(
  previous: Map<number, string> | null,
  settledNow: SettledBetSnapshot[],
  openBetIds: Iterable<number> = []
): Map<number, string> {
  const next = new Map(previous ?? []);
  for (const id of openBetIds) next.delete(id);
  for (const bet of settledNow) next.set(bet.id, bet.status);
  return next;
}

/** Bet ids to toast: fresh settles, plus void/push revisions. */
export function settledBetIdsToAnnounce(
  previous: Map<number, string> | null,
  settledNow: SettledBetSnapshot[],
  now: number
): number[] {
  if (previous == null) return [];
  const ids: number[] = [];
  for (const bet of settledNow) {
    const prev = previous.get(bet.id);
    if (prev == null) {
      if (bet.status === "void" || bet.status === "push") continue;
      if (!isRecentSettlement(bet.settledAt, now)) continue;
      ids.push(bet.id);
    } else if (prev !== bet.status && (bet.status === "void" || bet.status === "push")) {
      ids.push(bet.id);
    }
  }
  return ids;
}
