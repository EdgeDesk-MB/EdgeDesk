import { describe, expect, it } from "vitest";
import {
  acquiredFeedSyncRow,
  canAcquireFeedSyncLease,
  createInMemoryFeedSyncLease,
  hostedFeedSyncEnabled,
  FEED_SYNC_LEASE_MS,
  FEED_SYNC_MIN_INTERVAL_MS,
} from "@/lib/services/feed-sync-lease";

const NOW = 1_800_000_000_000;

describe("canAcquireFeedSyncLease", () => {
  it("lets the first caller in when no row exists", () => {
    expect(canAcquireFeedSyncLease(null, NOW)).toBe(true);
  });

  it("refuses while another instance holds the lease", () => {
    const row = acquiredFeedSyncRow("feed:live", NOW - 1_000);
    expect(canAcquireFeedSyncLease(row, NOW)).toBe(false);
  });

  it("re-acquires an expired lease", () => {
    const row = acquiredFeedSyncRow("feed:live", NOW - FEED_SYNC_LEASE_MS - 1);
    expect(canAcquireFeedSyncLease(row, NOW)).toBe(true);
  });

  it("suppresses a run inside the 20s throttle even with the lease released", () => {
    const row = { key: "feed:live", lastRunAt: NOW - 19_000, lockedUntil: 0 };
    expect(canAcquireFeedSyncLease(row, NOW)).toBe(false);
    expect(canAcquireFeedSyncLease(row, NOW + 1_001)).toBe(true);
  });

  it("uses the same throttle as the local external sync", () => {
    expect(FEED_SYNC_MIN_INTERVAL_MS).toBe(20_000);
  });
});

describe("hostedFeedSyncEnabled", () => {
  it("lets Vercel take the lease so Live stays the poller", () => {
    expect(hostedFeedSyncEnabled({ VERCEL: "1" })).toBe(true);
  });

  it("keeps localhost off the lease so its live=all cache cannot overwrite Neon", () => {
    expect(hostedFeedSyncEnabled({})).toBe(false);
    expect(hostedFeedSyncEnabled({ VERCEL: "1", EDGEWAYS_FEED_SYNC: "0" })).toBe(
      false
    );
  });

  it("allows an explicit local poller", () => {
    expect(hostedFeedSyncEnabled({ EDGEWAYS_FEED_SYNC: "1" })).toBe(true);
  });
});

describe("createInMemoryFeedSyncLease", () => {
  it("gives the lease to exactly one of two concurrent acquisitions", async () => {
    const lease = createInMemoryFeedSyncLease();
    const [a, b] = await Promise.all([
      lease.acquire("feed:live", NOW),
      lease.acquire("feed:live", NOW),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("blocks a second window until the throttle elapses, then allows it", async () => {
    const lease = createInMemoryFeedSyncLease();
    expect(await lease.acquire("feed:live", NOW)).toBe(true);
    await lease.release("feed:live");

    expect(await lease.acquire("feed:live", NOW + 19_999)).toBe(false);
    expect(await lease.acquire("feed:live", NOW + 20_000)).toBe(true);
  });

  it("recovers when a holder dies without releasing", async () => {
    const lease = createInMemoryFeedSyncLease();
    expect(await lease.acquire("feed:live", NOW)).toBe(true);
    // No release: the crashed instance still "holds" it.
    expect(await lease.acquire("feed:live", NOW + 30_000)).toBe(false);
    expect(await lease.acquire("feed:live", NOW + FEED_SYNC_LEASE_MS + 1)).toBe(true);
  });
});
