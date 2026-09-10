import { describe, expect, it } from "vitest";
import {
  activeCriticalKeysFromEvents,
  feedLaneLiveEvents,
  healthDownLiveEvents,
  keepPositiveLiveActor,
  serialiseLiveFingerprint,
  volumeRowToLiveEvent,
} from "./live-events";
import type { FeedMonitor } from "./feeds";
import type { HealthReport } from "./health";

describe("keepPositiveLiveActor", () => {
  const filter = {
    excludeAdmins: true,
    excludedIds: new Set(["user_test"]),
    adminIds: new Set(["user_ops"]),
  };

  it("drops test accounts and operator desks when those filters are on", () => {
    expect(keepPositiveLiveActor("user_test", filter)).toBe(false);
    expect(keepPositiveLiveActor("user_ops", filter)).toBe(false);
    expect(keepPositiveLiveActor("user_customer", filter)).toBe(true);
  });

  it("keeps operator desks when Exclude admins is off", () => {
    expect(
      keepPositiveLiveActor("user_ops", { ...filter, excludeAdmins: false })
    ).toBe(true);
  });
});

describe("volumeRowToLiveEvent", () => {
  it("names the desk email in the toast title", () => {
    expect(
      volumeRowToLiveEvent({
        kind: "bet_created",
        row: { id: "12", at: 1, clerkUserId: "user_a" },
        email: "ninja@example.com",
      }).title
    ).toBe("Bet placed · ninja@example.com");
  });
});

describe("ops snapshots", () => {
  it("emits a warning and a critical feed lane, not a healthy one", () => {
    const monitor = {
      football: { used: 72, cap: 100, state: "warning" },
      racing: { used: 91, cap: 100, state: "critical" },
    } as FeedMonitor;
    const events = feedLaneLiveEvents(monitor);
    expect(events.map((event) => event.kind).sort()).toEqual([
      "feed_critical",
      "feed_warning",
    ]);
    expect(activeCriticalKeysFromEvents(events).sort()).toEqual([
      "feed:football",
      "feed:racing",
    ]);
  });

  it("only toasts health checks that are down", () => {
    const report = {
      generatedAt: 10,
      overall: "down",
      checks: [
        { key: "neon", label: "Neon Postgres", status: "down", detail: "Timeout" },
        { key: "stripe", label: "Stripe", status: "warn" },
      ],
    } as HealthReport;
    const events = healthDownLiveEvents(report);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Neon Postgres is down");
    expect(events[0]?.coalesceKey).toBe("health:neon");
  });
});

describe("serialiseLiveFingerprint", () => {
  it("changes when a count or health bit moves", () => {
    const base = {
      bets: { n: 1, maxAt: 2 },
      offers: { n: 0, maxAt: 0 },
      casino: { n: 0, maxAt: 0 },
      signups: { n: 0, maxAt: 0 },
      inbox: { n: 0, maxAt: 0 },
      waitlist: { n: 0, maxAt: 0 },
      footballUsed: 10,
      racingUsed: 0,
      health: "ok",
    };
    expect(serialiseLiveFingerprint({ ...base, bets: { n: 2, maxAt: 2 } })).not.toBe(
      serialiseLiveFingerprint(base)
    );
    expect(serialiseLiveFingerprint({ ...base, health: "down" })).not.toBe(
      serialiseLiveFingerprint(base)
    );
    expect(
      serialiseLiveFingerprint({ ...base, signups: { n: 0, maxAt: 9 } })
    ).not.toBe(serialiseLiveFingerprint(base));
    expect(
      serialiseLiveFingerprint({ ...base, inbox: { n: 1, maxAt: 4 } })
    ).not.toBe(serialiseLiveFingerprint(base));
  });
});
