import { describe, expect, it } from "vitest";
import type { BetRow } from "@/lib/db/schema";
import { computePaceStats } from "./pace-stats";

function bet(partial: Partial<BetRow> & { actualProfit: number; settledAt: number }): BetRow {
  return {
    id: 1,
    label: "t",
    status: "won",
    bookmaker: null,
    exchangeId: null,
    eventId: null,
    backStake: 10,
    backOdds: 2,
    layStake: 0,
    layOdds: 0,
    commission: 0,
    expectedProfit: null,
    triggerText: null,
    notes: null,
    balanceLedgered: 0,
    createdAt: partial.settledAt,
    ...partial,
  } as BetRow;
}

describe("computePaceStats", () => {
  it("returns zeros with no settled activity", () => {
    const s = computePaceStats([]);
    expect(s.dayCount).toBe(0);
    expect(s.dailyAvg).toBe(0);
    expect(s.yearlyEst).toBe(0);
    expect(s.settlementCount).toBe(0);
  });

  it("counts inclusive calendar days and yearly = daily × 365", () => {
    // Activity starts 9 days before "today" → 10 inclusive days
    const now = Date.UTC(2026, 6, 10, 12); // 10 Jul 2026 noon UTC
    const start = Date.UTC(2026, 6, 1, 15); // 1 Jul 2026
    const s = computePaceStats(
      [bet({ id: 1, actualProfit: 100, settledAt: start })],
      [],
      now
    );
    expect(s.dayCount).toBe(10);
    expect(s.totalProfit).toBe(100);
    expect(s.dailyAvg).toBe(10);
    expect(s.yearlyEst).toBe(3650);
  });

  it("uses earliest settled bet as activity start", () => {
    const now = Date.UTC(2026, 6, 5);
    const s = computePaceStats(
      [
        bet({ id: 1, actualProfit: 20, settledAt: Date.UTC(2026, 6, 4) }),
        bet({ id: 2, actualProfit: 30, settledAt: Date.UTC(2026, 6, 1) }),
      ],
      [],
      now
    );
    expect(s.dayCount).toBe(5);
    expect(s.totalProfit).toBe(50);
    expect(s.dailyAvg).toBe(10);
    expect(s.yearlyEst).toBe(3650);
  });

  it("includes boost bets, casino settlements and P&L adjustments", () => {
    const now = Date.UTC(2026, 6, 10);
    const s = computePaceStats(
      [
        bet({ id: 1, actualProfit: 40, settledAt: Date.UTC(2026, 6, 5), betType: "qualifying" }),
        bet({ id: 2, actualProfit: 10, settledAt: Date.UTC(2026, 6, 6), betType: "boost" }),
      ],
      [
        { time: Date.UTC(2026, 6, 1), amount: 11.31 }, // casino earlier → window start
        { time: Date.UTC(2026, 6, 8), amount: 5 }, // affectPnl adjustment
      ],
      now
    );
    // 1 Jul → 10 Jul inclusive = 10 days; total 40+10+11.31+5 = 66.31
    expect(s.dayCount).toBe(10);
    expect(s.totalProfit).toBeCloseTo(66.31, 2);
    expect(s.dailyAvg).toBeCloseTo(6.631, 3);
    expect(s.yearlyEst).toBeCloseTo(6.631 * 365, 2);
    expect(s.settlementCount).toBe(4);
    expect(s.activityStartMs).toBe(Date.UTC(2026, 6, 1));
  });

  it("paces from casino-only activity when there are no settled bets", () => {
    const now = Date.UTC(2026, 6, 5);
    const s = computePaceStats(
      [],
      [{ time: Date.UTC(2026, 6, 1), amount: 50 }],
      now
    );
    expect(s.dayCount).toBe(5);
    expect(s.totalProfit).toBe(50);
    expect(s.dailyAvg).toBe(10);
    expect(s.yearlyEst).toBe(3650);
    expect(s.settlementCount).toBe(1);
  });
});
