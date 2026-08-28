/**
 * Same approach as neon-feed-sync.test.ts: a fake that answers only the exact
 * statements the budget module issues, emulating Postgres' ON CONFLICT DO UPDATE
 * ... WHERE ... RETURNING semantics. Keys are `feed:day`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, number>();

type UsageEventRow = {
  feed: string;
  day: string;
  at: number;
  operation: string;
  clerk_user_id: string | null;
  email: string | null;
};
const usageEvents: UsageEventRow[] = [];

const keyOf = (feed: string, day: string) => `${feed}:${day}`;

vi.mock("@/lib/db/neon", () => ({
  getNeonSql: () => ({
    query: async (text: string, params: unknown[]) => {
      const {
        FEED_BUDGET_SPEND_SQL,
        FEED_USAGE_RECORD_SQL,
        FEED_USAGE_EVENT_INSERT_SQL,
      } = await import("@/lib/db/neon-feed-budget");
      if (text === FEED_BUDGET_SPEND_SQL) {
        const [feed, day, budget] = params as [string, string, number];
        const key = keyOf(feed, day);
        const used = store.get(key);
        if (used == null) {
          store.set(key, 1);
          return [{ used: 1 }];
        }
        if (used < budget) {
          store.set(key, used + 1);
          return [{ used: used + 1 }];
        }
        return [];
      }
      if (text === FEED_USAGE_RECORD_SQL) {
        const [feed, day] = params as [string, string];
        const key = keyOf(feed, day);
        const used = (store.get(key) ?? 0) + 1;
        store.set(key, used);
        return [{ used }];
      }
      if (text === FEED_USAGE_EVENT_INSERT_SQL) {
        const [feed, day, at, operation, clerk_user_id, email] = params as [
          string,
          string,
          number,
          string,
          string | null,
          string | null,
        ];
        usageEvents.push({ feed, day, at, operation, clerk_user_id, email });
        return [];
      }
      if (text.includes("FROM feed_usage_events")) {
        const [day] = params as [string];
        const groups = new Map<string, number>();
        for (const event of usageEvents) {
          if (event.day !== day) continue;
          const key = [
            event.feed,
            event.clerk_user_id ?? "",
            event.email ?? "",
            event.operation,
          ].join(" ");
          groups.set(key, (groups.get(key) ?? 0) + 1);
        }
        return [...groups.entries()].map(([key, count]) => {
          const [feed, clerk_user_id, email, operation] = key.split(" ");
          return {
            feed,
            clerk_user_id: clerk_user_id || null,
            email: email || null,
            operation,
            count,
          };
        });
      }
      if (text.includes("SELECT used FROM feed_budget")) {
        const [feed, day] = params as [string, string];
        const used = store.get(keyOf(feed, day));
        return used == null ? [] : [{ used }];
      }
      if (text.includes("ORDER BY day DESC")) {
        const [feed, limit] = params as [string, number];
        return [...store.entries()]
          .filter(([key]) => key.startsWith(`${feed}:`))
          .map(([key, used]) => ({ day: key.slice(feed.length + 1), used }))
          .sort((a, b) => (a.day < b.day ? 1 : -1))
          .slice(0, limit);
      }
      throw new Error(`Unexpected SQL: ${text}`);
    },
  }),
}));

const {
  FEED_BUDGET_SPEND_SQL,
  FEED_USAGE_RECORD_SQL,
  feedBudgetDay,
  logFeedUsageEvent,
  neonFeedBudgetUsed,
  neonFeedUsageAttribution,
  neonFeedUsageHistory,
  recordNeonFeedUsage,
  spendNeonFeedBudget,
} = await import("@/lib/db/neon-feed-budget");
const { runWithDeskActor } = await import("@/lib/db/desk-scope");

beforeEach(() => {
  store.clear();
  usageEvents.length = 0;
});

describe("FEED_BUDGET_SPEND_SQL", () => {
  it("increments and checks in one guarded statement", () => {
    expect(FEED_BUDGET_SPEND_SQL).toContain("INSERT INTO feed_budget");
    expect(FEED_BUDGET_SPEND_SQL).toContain("ON CONFLICT (feed, day) DO UPDATE");
    expect(FEED_BUDGET_SPEND_SQL).toContain("used = feed_budget.used + 1");
    expect(FEED_BUDGET_SPEND_SQL).toContain("feed_budget.used < $3");
    expect(FEED_BUDGET_SPEND_SQL).toContain("RETURNING used");
    expect(FEED_BUDGET_SPEND_SQL.toUpperCase()).not.toContain("SELECT");
  });

  it("record SQL has no cap guard", () => {
    expect(FEED_USAGE_RECORD_SQL).toContain("ON CONFLICT (feed, day) DO UPDATE");
    expect(FEED_USAGE_RECORD_SQL).not.toContain("WHERE");
  });
});

describe("spendNeonFeedBudget", () => {
  it("persists increments across calls (survives a cold start)", async () => {
    expect(await spendNeonFeedBudget(95, "2026-08-23")).toBe(1);
    expect(await spendNeonFeedBudget(95, "2026-08-23")).toBe(2);
    expect(await spendNeonFeedBudget(95, "2026-08-23")).toBe(3);
    expect(await neonFeedBudgetUsed("2026-08-23")).toBe(3);
  });

  it("denies once the cap is reached and stops counting", async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await spendNeonFeedBudget(3, "2026-08-23")).toBe(i + 1);
    }
    expect(await spendNeonFeedBudget(3, "2026-08-23")).toBeNull();
    expect(await spendNeonFeedBudget(3, "2026-08-23")).toBeNull();
    expect(await neonFeedBudgetUsed("2026-08-23")).toBe(3);
  });

  it("counts globally: concurrent instances share the day's row", async () => {
    const claims = await Promise.all(
      Array.from({ length: 5 }, () => spendNeonFeedBudget(3, "2026-08-23"))
    );
    expect(claims.filter((c) => c != null)).toHaveLength(3);
    expect(claims.filter((c) => c == null)).toHaveLength(2);
  });

  it("resets on a new day", async () => {
    await spendNeonFeedBudget(2, "2026-08-23");
    await spendNeonFeedBudget(2, "2026-08-23");
    expect(await spendNeonFeedBudget(2, "2026-08-23")).toBeNull();
    expect(await spendNeonFeedBudget(2, "2026-08-24")).toBe(1);
    expect(await neonFeedBudgetUsed("2026-08-23")).toBe(2);
  });

  it("keys on the UTC calendar date", () => {
    expect(feedBudgetDay(new Date("2026-08-23T23:30:00Z"))).toBe("2026-08-23");
    expect(feedBudgetDay(new Date("2026-08-24T00:30:00Z"))).toBe("2026-08-24");
  });

  it("tracks feeds independently", async () => {
    expect(await spendNeonFeedBudget(2, "2026-08-23", "football")).toBe(1);
    expect(await recordNeonFeedUsage("racing", "2026-08-23")).toBe(1);
    expect(await recordNeonFeedUsage("racing", "2026-08-23")).toBe(2);
    expect(await neonFeedBudgetUsed("2026-08-23", "football")).toBe(1);
    expect(await neonFeedBudgetUsed("2026-08-23", "racing")).toBe(2);
  });
});

describe("recordNeonFeedUsage", () => {
  it("never denies: no cap on informational counters", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await recordNeonFeedUsage("racing", "2026-08-23")).toBe(i + 1);
    }
  });
});

describe("neonFeedUsageHistory", () => {
  it("returns newest-first rows for the feed only", async () => {
    await spendNeonFeedBudget(95, "2026-08-22", "football");
    await spendNeonFeedBudget(95, "2026-08-23", "football");
    await recordNeonFeedUsage("racing", "2026-08-23");
    const history = await neonFeedUsageHistory("football", 30);
    expect(history).toEqual([
      { day: "2026-08-23", used: 1 },
      { day: "2026-08-22", used: 1 },
    ]);
  });
});

describe("logFeedUsageEvent", () => {
  it("attributes the spend to the current desk actor", async () => {
    await runWithDeskActor(
      { clerkUserId: "user_abc", email: "ada@example.com" },
      () => logFeedUsageEvent("football", "fixtures-by-date", "2026-08-23")
    );

    expect(usageEvents).toHaveLength(1);
    expect(usageEvents[0]).toMatchObject({
      feed: "football",
      day: "2026-08-23",
      operation: "fixtures-by-date",
      clerk_user_id: "user_abc",
      email: "ada@example.com",
    });
    expect(typeof usageEvents[0].at).toBe("number");
  });

  it("records system spend when there is no actor", async () => {
    await logFeedUsageEvent("racing", "racecards-free", "2026-08-23");

    expect(usageEvents[0]).toMatchObject({
      feed: "racing",
      clerk_user_id: null,
      email: null,
    });
  });
});

describe("neonFeedUsageAttribution", () => {
  it("groups today's rows by feed, actor and operation", async () => {
    await runWithDeskActor(
      { clerkUserId: "user_abc", email: "ada@example.com" },
      async () => {
        await logFeedUsageEvent("football", "fixtures-by-date", "2026-08-23");
        await logFeedUsageEvent("football", "fixtures-by-date", "2026-08-23");
        await logFeedUsageEvent("football", "goal-events", "2026-08-23");
      }
    );
    await logFeedUsageEvent("football", "live-fixtures", "2026-08-23");
    await logFeedUsageEvent("racing", "racecards-free", "2026-08-23");
    // Another day must not leak into today's attribution.
    await logFeedUsageEvent("football", "fixtures-by-date", "2026-08-22");

    const rows = await neonFeedUsageAttribution("2026-08-23");
    expect(rows).toHaveLength(4);
    expect(rows).toContainEqual({
      feed: "football",
      clerkUserId: "user_abc",
      email: "ada@example.com",
      operation: "fixtures-by-date",
      count: 2,
    });
    expect(rows).toContainEqual({
      feed: "football",
      clerkUserId: null,
      email: null,
      operation: "live-fixtures",
      count: 1,
    });
    expect(rows).toContainEqual({
      feed: "racing",
      clerkUserId: null,
      email: null,
      operation: "racecards-free",
      count: 1,
    });
  });
});
