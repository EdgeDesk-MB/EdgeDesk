import { describe, expect, it } from "vitest";
import { mugDue, mugNetThisMonth } from "./mug-plan";

const DAY = 86_400_000;
const NOW = new Date("2026-07-16T12:00:00Z").getTime();

describe("mugDue", () => {
  it("a plan with no mug yet is due immediately", () => {
    const d = mugDue({ cadenceDays: 7, lastMugAt: null }, NOW);
    expect(d.due).toBe(true);
    expect(d.daysSince).toBeNull();
  });

  it("inside the cadence window it is not due; past it, it is", () => {
    const fresh = mugDue({ cadenceDays: 7, lastMugAt: NOW - 3 * DAY }, NOW);
    expect(fresh.due).toBe(false);
    expect(fresh.daysUntilDue).toBeCloseTo(4, 10);

    const overdue = mugDue({ cadenceDays: 7, lastMugAt: NOW - 9 * DAY }, NOW);
    expect(overdue.due).toBe(true);
    expect(overdue.daysSince).toBeCloseTo(9, 10);
    expect(overdue.daysUntilDue).toBeCloseTo(-2, 10);
  });

  it("exactly at the cadence boundary counts as due", () => {
    expect(mugDue({ cadenceDays: 7, lastMugAt: NOW - 7 * DAY }, NOW).due).toBe(true);
  });
});

describe("mugNetThisMonth", () => {
  const bet = (over: Record<string, unknown>) => ({
    purpose: "mug" as string | null,
    bookmaker: "Bet365" as string | null,
    actualProfit: -5 as number | null,
    settledAt: NOW - DAY as number | null,
    status: "lost",
    ...over,
  });

  it("sums only settled mug bets for the bookie in the current month", () => {
    const bets = [
      bet({}), // −5 counts
      bet({ actualProfit: 2, status: "won" }), // +2 counts (a mug can win)
      bet({ bookmaker: "Sky Bet" }), // other bookie
      bet({ purpose: null }), // edge bet, excluded
      bet({ settledAt: NOW - 40 * DAY }), // last month
      bet({ actualProfit: null, settledAt: null, status: "open" }), // unsettled
      bet({ actualProfit: 0, status: "void" }), // voids never count
    ];
    expect(mugNetThisMonth(bets, "Bet365", NOW)).toBe(-3);
  });

  it("no mug bets → £0", () => {
    expect(mugNetThisMonth([bet({ purpose: null })], "Bet365", NOW)).toBe(0);
  });
});
