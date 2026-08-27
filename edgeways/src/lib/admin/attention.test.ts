import { describe, expect, it } from "vitest";
import {
  buildAttentionItems,
  countFailedPayments,
  countFeedLanesAtRisk,
  countTrialsEnding,
} from "@/lib/admin/attention";
import type { FeedMonitor, FeedMonitorLane } from "@/lib/admin/feeds";
import type { StripeOverview } from "@/lib/admin/stripe-overview";
import type { AdminUserRow } from "@/lib/services/app-users";

const NOW = Date.UTC(2026, 7, 27, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function user(overrides: Partial<AdminUserRow>): AdminUserRow {
  return {
    clerkUserId: "user_1",
    email: "a@b.co",
    plan: "free",
    billingStatus: "none",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEndsAt: null,
    cancelAt: null,
    founding: false,
    onboardingProfile: null,
    role: "user",
    admin: false,
    createdAt: NOW - 30 * DAY,
    updatedAt: NOW - 30 * DAY,
    ...overrides,
  } as AdminUserRow;
}

function lane(state: FeedMonitorLane["state"]): FeedMonitorLane {
  return { used: 0, cap: 100, state, projected: 0, capReachedAt: null, history: [] };
}

function monitor(
  football: FeedMonitorLane["state"],
  racing: FeedMonitorLane["state"]
): FeedMonitor {
  return {
    hosted: true,
    caps: {},
    football: lane(football),
    racing: lane(racing),
    demand: { liveFootball: 0, upcomingFootball: 0 },
  } as unknown as FeedMonitor;
}

function stripe(overrides: Partial<StripeOverview>): StripeOverview {
  return {
    configured: true,
    mode: "test",
    mrrLabel: "£0",
    active: 0,
    trialing: 0,
    pastDue: 0,
    canceled: 0,
    founding: 0,
    invoices: [],
    refunds: [],
    failed: [],
    invoicePoints: [],
    refundPoints: [],
    subscriptionCreatedAt: [],
    stripeCustomerIds: [],
    ...overrides,
  };
}

describe("countTrialsEnding", () => {
  it("counts trials ending within 7 days, not past or beyond", () => {
    const users = [
      user({ clerkUserId: "a", trialEndsAt: NOW + 2 * DAY }),
      user({ clerkUserId: "b", trialEndsAt: NOW + 8 * DAY }),
      user({ clerkUserId: "c", trialEndsAt: NOW - DAY }),
      user({ clerkUserId: "d", trialEndsAt: null }),
    ];
    expect(countTrialsEnding(users, NOW)).toBe(1);
  });
});

describe("countFeedLanesAtRisk", () => {
  it("counts warning and critical lanes only", () => {
    expect(countFeedLanesAtRisk(monitor("ok", "ok"))).toBe(0);
    expect(countFeedLanesAtRisk(monitor("warning", "ok"))).toBe(1);
    expect(countFeedLanesAtRisk(monitor("warning", "critical"))).toBe(2);
  });
});

describe("countFailedPayments", () => {
  it("adds past-due subs to failed invoices", () => {
    const overview = stripe({
      pastDue: 2,
      failed: [
        { id: "in_1", email: null, amountLabel: "£10", status: "open", createdAt: NOW },
      ],
    });
    expect(countFailedPayments(overview)).toBe(3);
  });
});

describe("buildAttentionItems", () => {
  it("returns nothing when the platform is quiet", () => {
    const items = buildAttentionItems({
      stripe: stripe({}),
      users: [user({})],
      feedMonitor: monitor("ok", "ok"),
      banner: { enabled: false, message: "" },
      untriaged: [],
      now: NOW,
    });
    expect(items).toEqual([]);
  });

  it("flags failed payments as destructive and links to payments", () => {
    const items = buildAttentionItems({
      stripe: stripe({ pastDue: 1 }),
      users: [],
      feedMonitor: monitor("ok", "ok"),
      banner: { enabled: false, message: "" },
      untriaged: [],
      now: NOW,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: "payments",
      tone: "destructive",
      href: "/admin/payments",
    });
  });

  it("includes trials, feeds, banner and feedback when active", () => {
    const items = buildAttentionItems({
      stripe: stripe({}),
      users: [user({ trialEndsAt: NOW + DAY })],
      feedMonitor: monitor("critical", "ok"),
      banner: { enabled: true, message: "Down" },
      untriaged: [{ id: 1 } as never],
      now: NOW,
    });
    expect(items.map((item) => item.key)).toEqual([
      "trials",
      "feeds",
      "banner",
      "feedback",
    ]);
    expect(items.every((item) => item.tone === "warning")).toBe(true);
  });
});
