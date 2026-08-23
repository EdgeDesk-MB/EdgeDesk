/**
 * Neon-backed lease for the global feed poller (EDGE-81b).
 *
 * Vercel runs an unbounded number of serverless instances, so "poll every 20s"
 * has to be coordinated in the database rather than in module state. Acquisition
 * is ONE statement: the INSERT ... ON CONFLICT DO UPDATE below both takes the
 * lease and enforces the 20s throttle in its WHERE clause, so two instances
 * racing on the same millisecond cannot both win (check-then-write could).
 *
 * `feed_sync_state` is global coordination data — no clerk scoping.
 */
import "server-only";

import { getNeonSql } from "@/lib/db/neon";
import {
  FEED_SYNC_LEASE_MS,
  FEED_SYNC_MIN_INTERVAL_MS,
  type FeedSyncLease,
  type FeedSyncStateRow,
} from "@/lib/services/feed-sync-lease";

/**
 * Kept as a constant so a test can assert the guard never loses its
 * `locked_until` / `last_run_at` conditions (that would turn the lease into a
 * no-op and let every instance poll).
 */
export const FEED_SYNC_ACQUIRE_SQL = `
INSERT INTO feed_sync_state (key, last_run_at, locked_until)
VALUES ($1, $2, $3)
ON CONFLICT (key) DO UPDATE
   SET last_run_at = $2,
       locked_until = $3
 WHERE feed_sync_state.locked_until <= $2
   AND feed_sync_state.last_run_at <= $4
RETURNING key
`.trim();

export function neonFeedSyncLease(options?: {
  leaseMs?: number;
  minIntervalMs?: number;
}): FeedSyncLease {
  const leaseMs = options?.leaseMs ?? FEED_SYNC_LEASE_MS;
  const minIntervalMs = options?.minIntervalMs ?? FEED_SYNC_MIN_INTERVAL_MS;
  return {
    async acquire(key, now = Date.now()) {
      const sql = getNeonSql();
      const rows = (await sql.query(FEED_SYNC_ACQUIRE_SQL, [
        key,
        now,
        now + leaseMs,
        now - minIntervalMs,
      ])) as unknown[];
      return rows.length > 0;
    },
    async release(key) {
      const sql = getNeonSql();
      await sql.query(
        `UPDATE feed_sync_state SET locked_until = 0 WHERE key = $1`,
        [key]
      );
    },
  };
}

/** Diagnostics only; the poller never reads before writing. */
export async function readNeonFeedSyncState(
  key: string
): Promise<FeedSyncStateRow | null> {
  const sql = getNeonSql();
  const rows = (await sql.query(
    `SELECT key, last_run_at, locked_until FROM feed_sync_state WHERE key = $1`,
    [key]
  )) as Array<{ key: string; last_run_at: string | number; locked_until: string | number }>;
  const row = rows[0];
  if (!row) return null;
  return {
    key: row.key,
    lastRunAt: Number(row.last_run_at),
    lockedUntil: Number(row.locked_until),
  };
}
