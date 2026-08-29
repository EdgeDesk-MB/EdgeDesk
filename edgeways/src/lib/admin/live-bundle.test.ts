import { describe, expect, it } from "vitest";
import {
  adminLiveLogDedupe,
  adminLivePushTag,
  bundleNewEvents,
  crossedDigestCount,
  digestTitle,
  emptyLiveBundleMemory,
  pruneLiveWindow,
  reconcileLiveCritical,
  type LiveBundle,
  type LiveEvent,
} from "./live-bundle";

const NOW = Date.parse("2026-08-29T10:00:00Z");
const HOUR = 60 * 60 * 1000;

function bet(id: string, at: number, email = "a@example.com"): LiveEvent {
  return {
    id,
    kind: "bet_created",
    tone: "success",
    at,
    title: `Bet placed · ${email}`,
    href: "/admin/activity",
    clerkUserId: "user_a",
  };
}

describe("crossedDigestCount", () => {
  it("stays silent under the start threshold", () => {
    expect(crossedDigestCount(3, 9, 10, 50)).toBeNull();
  });

  it("emits 10 when the window first reaches the start", () => {
    expect(crossedDigestCount(9, 11, 10, 50)).toBe(10);
  });

  it("emits the highest ten crossed in one jump", () => {
    expect(crossedDigestCount(8, 22, 10, 50)).toBe(20);
  });

  it("switches to fifties at and above the high step", () => {
    expect(crossedDigestCount(45, 52, 10, 50)).toBe(50);
    expect(crossedDigestCount(50, 99, 10, 50)).toBeNull();
    expect(crossedDigestCount(99, 100, 10, 50)).toBe(100);
  });
});

describe("bundleNewEvents", () => {
  it("toasts each bet while the hour stays under 10", () => {
    const first = bundleNewEvents({
      events: [bet("1", NOW - 1000), bet("2", NOW - 500)],
      now: NOW,
      memory: emptyLiveBundleMemory(),
    });
    expect(first.bundles).toHaveLength(2);
    expect(first.bundles[0]?.title).toContain("Bet placed");

    const second = bundleNewEvents({
      events: [bet("3", NOW)],
      now: NOW,
      memory: first.memory,
    });
    expect(second.bundles).toHaveLength(1);
  });

  it("switches to hourly digests once 10 bets land", () => {
    const seeded = bundleNewEvents({
      events: Array.from({ length: 9 }, (_, i) => bet(String(i), NOW - 9_000 + i)),
      now: NOW,
      memory: emptyLiveBundleMemory(),
    });
    expect(seeded.bundles).toHaveLength(9);

    const next = bundleNewEvents({
      events: [bet("10", NOW), bet("11", NOW + 1)],
      now: NOW + 1,
      memory: seeded.memory,
    });
    expect(next.bundles).toHaveLength(1);
    expect(next.bundles[0]?.title).toBe("10 bets placed in the past hour");
    expect(next.bundles[0]?.count).toBe(10);
  });

  it("does not mix bets with casino campaigns", () => {
    const result = bundleNewEvents({
      events: [
        bet("1", NOW),
        {
          id: "c1",
          kind: "casino_created",
          tone: "success",
          at: NOW,
          title: "Casino campaign created · a@example.com",
          href: "/admin/activity",
        },
      ],
      now: NOW,
      memory: emptyLiveBundleMemory(),
    });
    expect(result.bundles.map((bundle) => bundle.kind).sort()).toEqual([
      "bet_created",
      "casino_created",
    ]);
  });

  it("coalesces the same feed warning until it steps up", () => {
    const warning: LiveEvent = {
      id: "w1",
      kind: "feed_warning",
      tone: "warning",
      at: NOW,
      title: "Football feed at 72% of cap",
      href: "/admin/feeds",
      coalesceKey: "feed:football",
    };
    const first = bundleNewEvents({
      events: [warning],
      now: NOW,
      memory: emptyLiveBundleMemory(),
    });
    expect(first.bundles).toHaveLength(1);
    const again = bundleNewEvents({
      events: [{ ...warning, id: "w2", at: NOW + 1000 }],
      now: NOW + 1000,
      memory: first.memory,
    });
    expect(again.bundles).toHaveLength(0);
    const critical = bundleNewEvents({
      events: [
        {
          ...warning,
          id: "c1",
          kind: "feed_critical",
          tone: "error",
          title: "Football feed at 91% of cap",
        },
      ],
      now: NOW + 2000,
      memory: again.memory,
    });
    expect(critical.bundles).toHaveLength(1);
    expect(critical.bundles[0]?.tone).toBe("error");
  });

  it("drops window rows older than the hour", () => {
    expect(
      pruneLiveWindow(
        [
          { kind: "bet_created", at: NOW - HOUR - 1 },
          { kind: "bet_created", at: NOW - 1000 },
        ],
        NOW,
        HOUR
      )
    ).toEqual([{ kind: "bet_created", at: NOW - 1000 }]);
  });
});

describe("digestTitle", () => {
  it("uses hour copy for a 60 minute window", () => {
    expect(digestTitle("signup", 10, HOUR)).toBe(
      "10 new accounts in the past hour"
    );
  });
});

describe("reconcileLiveCritical", () => {
  it("forgets a feed once it is healthy again", () => {
    const memory = emptyLiveBundleMemory();
    memory.critical["feed:football"] = "warning";
    memory.critical["health:neon"] = "error";
    expect(
      reconcileLiveCritical(memory, ["health:neon"]).critical
    ).toEqual({ "health:neon": "error" });
  });
});

describe("adminLivePushTag", () => {
  it("uses the coalesce key for feed and health so the shade replaces", () => {
    expect(
      adminLivePushTag({
        id: "1",
        kind: "feed_critical",
        tone: "error",
        title: "Football feed at 91% of cap",
        href: "/admin/feeds",
        count: 1,
        coalesceKey: "feed:football",
      })
    ).toBe("admin-live:feed:football");
  });

  it("collapses hourly digests of the same kind", () => {
    expect(
      adminLivePushTag({
        id: "digest:bet_created:20:1",
        kind: "bet_created",
        tone: "success",
        title: "20 bets placed in the past hour",
        href: "/admin/activity",
        count: 20,
      })
    ).toBe("admin-live:digest:bet_created");
  });
});

describe("adminLiveLogDedupe", () => {
  const digest: LiveBundle = {
    id: "digest:bet_created:10:1",
    kind: "bet_created",
    tone: "success",
    title: "10 bets placed in the past hour",
    href: "/admin/activity",
    count: 10,
  };

  it("keeps 10 and 20 as separate rows in the same hour", () => {
    const hour = Date.parse("2026-08-29T10:30:00Z");
    expect(adminLiveLogDedupe(digest, hour)).toBe(
      `admin-live:digest:bet_created:10:${Math.floor(hour / 3_600_000)}`
    );
    expect(
      adminLiveLogDedupe({ ...digest, id: "digest:bet_created:20:1", count: 20 }, hour)
    ).toBe(`admin-live:digest:bet_created:20:${Math.floor(hour / 3_600_000)}`);
  });

  it("reuses the coalesce key so a feed warning steps up in place", () => {
    expect(
      adminLiveLogDedupe(
        {
          id: "w1",
          kind: "feed_warning",
          tone: "warning",
          title: "Football feed at 72% of cap",
          href: "/admin/feeds",
          count: 1,
          coalesceKey: "feed:football",
        },
        NOW
      )
    ).toBe("admin-live:feed:football");
  });
});
