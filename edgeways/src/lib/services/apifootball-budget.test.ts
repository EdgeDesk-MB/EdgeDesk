/**
 * The hosted budget wiring (EDGE-81c): when the desk is Neon, every upstream
 * API-Football request must claim its slot from the shared `feed_budget` row
 * rather than a per-instance counter.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spendNeonFeedBudget = vi.fn<(budget: number, day?: string) => Promise<number | null>>();
const neonFeedBudgetUsed = vi.fn<(day?: string) => Promise<number>>();
const logFeedUsageEvent = vi.fn<(feed: string, operation: string) => Promise<void>>();

vi.mock("@/lib/db/desk-backend", () => ({ isNeonDesk: () => true }));
vi.mock("@/lib/db/neon-feed-budget", () => ({
  spendNeonFeedBudget: (budget: number, day?: string) => spendNeonFeedBudget(budget, day),
  neonFeedBudgetUsed: (day?: string) => neonFeedBudgetUsed(day),
  logFeedUsageEvent: (feed: string, operation: string) =>
    logFeedUsageEvent(feed, operation),
  feedBudgetDay: () => "2026-08-23",
}));

const { DAILY_BUDGET, apiUsageTodayAsync, fixturesByDate, footballOperation } = await import(
  "@/lib/services/apifootball"
);

let day = 0;

beforeEach(() => {
  vi.restoreAllMocks();
  spendNeonFeedBudget.mockReset();
  neonFeedBudgetUsed.mockReset();
  logFeedUsageEvent.mockReset();
  logFeedUsageEvent.mockResolvedValue(undefined);
  process.env.API_FOOTBALL_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ response: [], errors: null }),
    }))
  );
});

afterEach(() => {
  delete process.env.API_FOOTBALL_KEY;
  vi.unstubAllGlobals();
});

/** Distinct dates so the module's own fixtures cache never masks a request. */
function nextDate(): string {
  day += 1;
  return `2026-09-${String(day).padStart(2, "0")}`;
}

describe("hosted API-Football budget", () => {
  it("claims one durable slot per upstream request", async () => {
    spendNeonFeedBudget.mockResolvedValue(1);
    await fixturesByDate(nextDate());
    await fixturesByDate(nextDate());

    expect(spendNeonFeedBudget).toHaveBeenCalledTimes(2);
    expect(spendNeonFeedBudget).toHaveBeenCalledWith(DAILY_BUDGET, undefined);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("refuses the request when the shared counter is at the cap", async () => {
    spendNeonFeedBudget.mockResolvedValue(null);
    await expect(fixturesByDate(nextDate())).rejects.toThrow(
      /daily request budget exhausted/
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to the per-instance guard when Neon is unreachable", async () => {
    spendNeonFeedBudget.mockRejectedValue(new Error("connection refused"));
    await fixturesByDate(nextDate());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports hosted usage from Neon, not module state", async () => {
    neonFeedBudgetUsed.mockResolvedValue(42);
    expect(await apiUsageTodayAsync()).toEqual({ used: 42, budget: DAILY_BUDGET });
  });

  it("falls back to this instance's usage when Neon cannot be read", async () => {
    neonFeedBudgetUsed.mockRejectedValue(new Error("connection refused"));
    const usage = await apiUsageTodayAsync();
    expect(usage.budget).toBe(DAILY_BUDGET);
    expect(usage.used).toBeGreaterThanOrEqual(0);
  });

  it("logs an attribution event per spent request", async () => {
    spendNeonFeedBudget.mockResolvedValue(1);
    await fixturesByDate(nextDate());
    expect(logFeedUsageEvent).toHaveBeenCalledWith("football", "fixtures-by-date");
  });

  it("does not log when the shared counter denies the request", async () => {
    spendNeonFeedBudget.mockResolvedValue(null);
    await expect(fixturesByDate(nextDate())).rejects.toThrow(
      /daily request budget exhausted/
    );
    expect(logFeedUsageEvent).not.toHaveBeenCalled();
  });
});

describe("footballOperation", () => {
  it("derives the operation from the request path", () => {
    expect(footballOperation("/fixtures?date=2026-08-27")).toBe("fixtures-by-date");
    expect(footballOperation("/fixtures?live=all")).toBe("live-fixtures");
    expect(footballOperation("/fixtures?id=12345")).toBe("fixture-by-id");
    expect(footballOperation("/fixtures/events?fixture=1")).toBe("match-events");
    expect(footballOperation("/fixtures/lineups?fixture=1")).toBe("lineups");
    expect(footballOperation("/leagues?current=true")).toBe("leagues-catalog");
    expect(footballOperation("/status")).toBe("other");
  });
});
