import { describe, expect, it } from "vitest";
import { db, adminLiveLog } from "@/lib/db";
import {
  listAdminLiveLog,
  markAdminLiveLogRead,
  pruneAdminLiveLog,
  recordAdminLiveBundles,
} from "./live-log";
import {
  ADMIN_LIVE_LOG_CAP,
  ADMIN_LIVE_LOG_MAX_AGE_MS,
} from "./live-log-shared";
import type { LiveBundle } from "./live-bundle";

const NOW = Date.parse("2026-08-29T10:00:00Z");

function bet(id: string, count = 1): LiveBundle {
  return {
    id,
    kind: "bet_created",
    tone: "success",
    title: count > 1 ? `${count} bets placed in the past hour` : `Bet placed · ${id}`,
    href: "/admin/activity",
    count,
  };
}

function feed(tone: "warning" | "error", title: string): LiveBundle {
  return {
    id: tone === "error" ? "feed-critical" : "feed-warning",
    kind: tone === "error" ? "feed_critical" : "feed_warning",
    tone,
    title,
    href: "/admin/feeds",
    count: 1,
    coalesceKey: "feed:football",
  };
}

describe("recordAdminLiveBundles", () => {
  it("inserts an individual once and marks success as already read", async () => {
    await recordAdminLiveBundles([bet("bet_created:1")], NOW);
    await recordAdminLiveBundles([bet("bet_created:1")], NOW + 1);
    const list = await listAdminLiveLog();
    const row = list.rows.find((item) => item.dedupe === "admin-live:bet_created:1");
    expect(row).toBeDefined();
    expect(row?.readAt).toBe(NOW);
    expect(list.rows.filter((item) => item.dedupe === "admin-live:bet_created:1")).toHaveLength(1);
  });

  it("keeps digest 10 and digest 20 as two rows", async () => {
    await recordAdminLiveBundles([bet("digest:10", 10), bet("digest:20", 20)], NOW);
    const list = await listAdminLiveLog();
    const digests = list.rows.filter((row) => row.kind === "bet_created" && row.count > 1);
    expect(digests.map((row) => row.count).sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it("upserts a feed warning to critical and marks it unread", async () => {
    await recordAdminLiveBundles(
      [feed("warning", "Football feed at 72% of cap")],
      NOW
    );
    await recordAdminLiveBundles(
      [feed("error", "Football feed at 91% of cap")],
      NOW + 1000
    );
    const list = await listAdminLiveLog();
    const rows = list.rows.filter((row) => row.dedupe === "admin-live:feed:football");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tone).toBe("error");
    expect(rows[0]?.title).toContain("91%");
    expect(rows[0]?.readAt).toBeNull();
    expect(list.unread).toBeGreaterThanOrEqual(1);
  });

  it("mark all read clears unread watch and critical rows", async () => {
    await recordAdminLiveBundles(
      [feed("warning", "Football feed at 72% of cap")],
      NOW + 2000
    );
    const before = await listAdminLiveLog();
    expect(before.unread).toBeGreaterThan(0);
    const updated = await markAdminLiveLogRead({ all: true }, NOW + 3000);
    expect(updated).toBeGreaterThan(0);
    const after = await listAdminLiveLog();
    expect(after.unread).toBe(0);
  });
});

describe("pruneAdminLiveLog", () => {
  it("drops rows older than seven days and caps the rest", async () => {
    const stale = NOW - ADMIN_LIVE_LOG_MAX_AGE_MS - 1;
    db.insert(adminLiveLog)
      .values({
        dedupe: "stale-row",
        kind: "signup",
        tone: "success",
        title: "Old signup",
        body: null,
        href: "/admin/users",
        count: 1,
        createdAt: stale,
        updatedAt: stale,
        readAt: stale,
      })
      .run();

    const bundles: LiveBundle[] = Array.from({ length: ADMIN_LIVE_LOG_CAP + 5 }, (_, i) =>
      bet(`cap:${i}`)
    );
    await recordAdminLiveBundles(bundles, NOW + 4000);
    await pruneAdminLiveLog(NOW + 4000);

    const list = await listAdminLiveLog();
    expect(list.rows.some((row) => row.dedupe === "stale-row")).toBe(false);
    expect(list.rows.length).toBeLessThanOrEqual(ADMIN_LIVE_LOG_CAP);
    expect(list.truncated).toBe(false);
  });
});
