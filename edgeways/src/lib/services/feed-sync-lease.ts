/**
 * Lease rules for the global feed poller (EDGE-81b).
 *
 * Pure mirror of the single atomic statement in `db/neon-feed-sync.ts`. The
 * predicate lives here so it can be unit-tested and so the in-memory lease used
 * by tests behaves exactly like Postgres. Atomicity itself comes from Postgres
 * executing that one INSERT ... ON CONFLICT statement; this module only encodes
 * *which* attempt is allowed to win.
 */

/**
 * How long a winner holds the lease if it never releases it (crash, instance
 * torn down mid-flight). Long enough to cover a football + racing sync round,
 * short enough that a dead instance does not stall the feed for long.
 */
export const FEED_SYNC_LEASE_MS = 60_000;

/** Matches EXTERNAL_SYNC_MIN_MS on the local path: at most one sync per 20s. */
export const FEED_SYNC_MIN_INTERVAL_MS = 20_000;

/** The single feed key. One poller covers football scores + racing results. */
export const FEED_SYNC_KEY = "feed:live";

export type FeedSyncStateRow = {
  key: string;
  lastRunAt: number;
  lockedUntil: number;
};

export type FeedSyncLease = {
  /** True when this caller won the lease and should run the sync. */
  acquire(key: string, now?: number): Promise<boolean>;
  /** Frees the lease early so the next 20s window is not wasted. */
  release(key: string, now?: number): Promise<void>;
};

/**
 * The WHERE clause of the atomic UPDATE, in TypeScript. A missing row always
 * wins (the INSERT branch).
 */
export function canAcquireFeedSyncLease(
  row: FeedSyncStateRow | null | undefined,
  now: number,
  minIntervalMs = FEED_SYNC_MIN_INTERVAL_MS
): boolean {
  if (!row) return true;
  return row.lockedUntil <= now && row.lastRunAt <= now - minIntervalMs;
}

/** The SET clause of the atomic UPDATE, in TypeScript. */
export function acquiredFeedSyncRow(
  key: string,
  now: number,
  leaseMs = FEED_SYNC_LEASE_MS
): FeedSyncStateRow {
  return { key, lastRunAt: now, lockedUntil: now + leaseMs };
}

/**
 * Lease over a plain Map. Used by tests and as a safety net when Neon is
 * unreachable; JavaScript's single-threaded turn gives the same
 * one-winner-per-window guarantee inside a single process.
 */
export function createInMemoryFeedSyncLease(options?: {
  leaseMs?: number;
  minIntervalMs?: number;
  store?: Map<string, FeedSyncStateRow>;
}): FeedSyncLease & { rows: Map<string, FeedSyncStateRow> } {
  const rows = options?.store ?? new Map<string, FeedSyncStateRow>();
  const leaseMs = options?.leaseMs ?? FEED_SYNC_LEASE_MS;
  const minIntervalMs = options?.minIntervalMs ?? FEED_SYNC_MIN_INTERVAL_MS;
  return {
    rows,
    async acquire(key, now = Date.now()) {
      if (!canAcquireFeedSyncLease(rows.get(key), now, minIntervalMs)) return false;
      rows.set(key, acquiredFeedSyncRow(key, now, leaseMs));
      return true;
    },
    async release(key) {
      const row = rows.get(key);
      if (row) rows.set(key, { ...row, lockedUntil: 0 });
    },
  };
}
