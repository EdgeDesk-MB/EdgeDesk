/**
 * Same approach as neon-feed-sync.test.ts: a fake that answers only the exact
 * statements the budget module issues, emulating Postgres' ON CONFLICT DO UPDATE
 * ... WHERE ... RETURNING semantics.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, number>();

const SELECT_SQL = `SELECT used FROM feed_budget WHERE day = $1`;

vi.mock("@/lib/db/neon", () => ({
  getNeonSql: () => ({
    query: async (text: string, params: unknown[]) => {
      const { FEED_BUDGET_SPEND_SQL } = await import("@/lib/db/neon-feed-budget");
      if (text === FEED_BUDGET_SPEND_SQL) {
        const [day, budget] = params as [string, number];
        const used = store.get(day);
        if (used == null) {
          store.set(day, 1);
          return [{ used: 1 }];
        }
        if (used < budget) {
          store.set(day, used + 1);
          return [{ used: used + 1 }];
        }
        return [];
      }
      if (text === SELECT_SQL) {
        const used = store.get(params[0] as string);
        return used == null ? [] : [{ used }];
      }
      throw new Error(`Unexpected SQL: ${text}`);
    },
  }),
}));

const {
  FEED_BUDGET_SPEND_SQL,
  feedBudgetDay,
  neonFeedBudgetUsed,
  spendNeonFeedBudget,
} = await import("@/lib/db/neon-feed-budget");

beforeEach(() => {
  store.clear();
});

describe("FEED_BUDGET_SPEND_SQL", () => {
  it("increments and checks in one guarded statement", () => {
    expect(FEED_BUDGET_SPEND_SQL).toContain("INSERT INTO feed_budget");
    expect(FEED_BUDGET_SPEND_SQL).toContain("ON CONFLICT (day) DO UPDATE");
    expect(FEED_BUDGET_SPEND_SQL).toContain("used = feed_budget.used + 1");
    expect(FEED_BUDGET_SPEND_SQL).toContain("feed_budget.used < $2");
    expect(FEED_BUDGET_SPEND_SQL).toContain("RETURNING used");
    expect(FEED_BUDGET_SPEND_SQL.toUpperCase()).not.toContain("SELECT");
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
});
