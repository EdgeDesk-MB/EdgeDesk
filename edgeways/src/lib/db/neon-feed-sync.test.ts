/**
 * Exercises the real lease module against a fake that emulates ONLY the two
 * statements it issues. The fake refuses to answer anything it does not
 * recognise, so a drifted SQL string or a reordered parameter list fails here
 * rather than silently disabling the lease in production.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { key: string; last_run_at: number; locked_until: number };

const store = new Map<string, Row>();

const RELEASE_SQL = `UPDATE feed_sync_state SET locked_until = 0 WHERE key = $1`;
const SELECT_SQL = `SELECT key, last_run_at, locked_until FROM feed_sync_state WHERE key = $1`;

vi.mock("@/lib/db/neon", () => ({
  getNeonSql: () => ({
    query: async (text: string, params: unknown[]) => {
      const { FEED_SYNC_ACQUIRE_SQL } = await import("@/lib/db/neon-feed-sync");
      if (text === FEED_SYNC_ACQUIRE_SQL) {
        const [key, now, lockedUntil, throttleCutoff] = params as [
          string,
          number,
          number,
          number,
        ];
        const row = store.get(key);
        if (!row) {
          store.set(key, { key, last_run_at: now, locked_until: lockedUntil });
          return [{ key }];
        }
        if (row.locked_until <= now && row.last_run_at <= throttleCutoff) {
          store.set(key, { key, last_run_at: now, locked_until: lockedUntil });
          return [{ key }];
        }
        return [];
      }
      if (text === RELEASE_SQL) {
        const key = params[0] as string;
        const row = store.get(key);
        if (row) store.set(key, { ...row, locked_until: 0 });
        return [];
      }
      if (text === SELECT_SQL) {
        const row = store.get(params[0] as string);
        return row ? [row] : [];
      }
      throw new Error(`Unexpected SQL: ${text}`);
    },
  }),
}));

const { FEED_SYNC_ACQUIRE_SQL, neonFeedSyncLease, readNeonFeedSyncState } =
  await import("@/lib/db/neon-feed-sync");

const KEY = "feed:live";
const NOW = 1_800_000_000_000;

beforeEach(() => {
  store.clear();
});

describe("FEED_SYNC_ACQUIRE_SQL", () => {
  it("is one statement that both leases and throttles", () => {
    expect(FEED_SYNC_ACQUIRE_SQL).toContain("INSERT INTO feed_sync_state");
    expect(FEED_SYNC_ACQUIRE_SQL).toContain("ON CONFLICT (key) DO UPDATE");
    expect(FEED_SYNC_ACQUIRE_SQL).toContain("feed_sync_state.locked_until <= $2");
    expect(FEED_SYNC_ACQUIRE_SQL).toContain("feed_sync_state.last_run_at <= $4");
    expect(FEED_SYNC_ACQUIRE_SQL).toContain("RETURNING key");
    // A SELECT before the write would be check-then-write, not atomic.
    expect(FEED_SYNC_ACQUIRE_SQL.toUpperCase()).not.toContain("SELECT");
  });
});

describe("neonFeedSyncLease", () => {
  it("lets only one of two concurrent acquisitions win", async () => {
    const lease = neonFeedSyncLease();
    const results = await Promise.all([
      lease.acquire(KEY, NOW),
      lease.acquire(KEY, NOW),
      lease.acquire(KEY, NOW),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("records the lease window and the run time", async () => {
    const lease = neonFeedSyncLease({ leaseMs: 60_000 });
    await lease.acquire(KEY, NOW);
    expect(await readNeonFeedSyncState(KEY)).toEqual({
      key: KEY,
      lastRunAt: NOW,
      lockedUntil: NOW + 60_000,
    });
  });

  it("suppresses runs inside the 20s throttle after a release", async () => {
    const lease = neonFeedSyncLease();
    expect(await lease.acquire(KEY, NOW)).toBe(true);
    await lease.release(KEY);
    expect(await lease.acquire(KEY, NOW + 5_000)).toBe(false);
    expect(await lease.acquire(KEY, NOW + 20_000)).toBe(true);
  });

  it("re-acquires after an expired lease when the holder never released", async () => {
    const lease = neonFeedSyncLease({ leaseMs: 60_000 });
    expect(await lease.acquire(KEY, NOW)).toBe(true);
    expect(await lease.acquire(KEY, NOW + 59_999)).toBe(false);
    expect(await lease.acquire(KEY, NOW + 60_001)).toBe(true);
  });
});
