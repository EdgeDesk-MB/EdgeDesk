/**
 * Home Live dock prefs — expand/collapse + per-row locks that stay visible
 * when the dock is collapsed. Client-only (localStorage).
 */

export const LIVE_DOCK_EXPANDED_KEY = "edgeways-live-dock-expanded";
export const LIVE_DOCK_LOCKS_KEY = "edgeways-live-dock-locks";

export type LiveDockLocks = {
  events: number[];
  positions: number[];
};

const EMPTY_LOCKS: LiveDockLocks = { events: [], positions: [] };

function asIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    const n = typeof item === "number" ? item : Number(item);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

export function readLiveDockExpanded(defaultExpanded = true): boolean {
  if (typeof window === "undefined") return defaultExpanded;
  try {
    const raw = window.localStorage.getItem(LIVE_DOCK_EXPANDED_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* private mode */
  }
  return defaultExpanded;
}

export function writeLiveDockExpanded(expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIVE_DOCK_EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function readLiveDockLocks(): LiveDockLocks {
  if (typeof window === "undefined") return EMPTY_LOCKS;
  try {
    const raw = window.localStorage.getItem(LIVE_DOCK_LOCKS_KEY);
    if (!raw) return EMPTY_LOCKS;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return EMPTY_LOCKS;
    const obj = parsed as Record<string, unknown>;
    return {
      events: asIdList(obj.events),
      positions: asIdList(obj.positions),
    };
  } catch {
    return EMPTY_LOCKS;
  }
}

export function writeLiveDockLocks(locks: LiveDockLocks): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIVE_DOCK_LOCKS_KEY, JSON.stringify(locks));
  } catch {
    /* private mode */
  }
}

/** Drop locks for rows that are no longer live. */
export function pruneLiveDockLocks(
  locks: LiveDockLocks,
  liveEventIds: Iterable<number>,
  livePositionIds: Iterable<number>
): LiveDockLocks {
  const events = new Set(liveEventIds);
  const positions = new Set(livePositionIds);
  return {
    events: locks.events.filter((id) => events.has(id)),
    positions: locks.positions.filter((id) => positions.has(id)),
  };
}

export function toggleLockId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
