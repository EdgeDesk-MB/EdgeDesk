/**
 * Same approach as neon-feed-sync.test.ts: a fake that answers only the exact
 * statements the budget module issues, emulating Postgres' ON CONFLICT DO UPDATE
 * ... WHERE ... RETURNING semantics. Keys are `feed:day`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, number>();

const keyOf = (feed: string, day: string) => `${feed}:${day}`;

vi.mock("@/lib/db/neon", () => ({
  getNeonSql: () => ({
    query: async (text: string, params: unknown[]) => {
      const {
        FEED_BUDGET_SPEND_SQL,
        FEED_USAGE_RECORD_SQL,
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
  neonFeedBudgetUsed,
  neonFeedUsageHistory,
  recordNeonFeedUsage,
  spendNeonFeedBudget,
} = await import("@/lib/db/neon-feed-budget");

beforeEach(() => {
  store.clear();
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
