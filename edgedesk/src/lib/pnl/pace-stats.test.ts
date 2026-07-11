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
    actualProfit: partial.actualProfit,
    triggerText: null,
    notes: null,
    balanceLedgered: 0,
    createdAt: partial.settledAt,
    settledAt: partial.settledAt,
    ...partial,
  } as BetRow;
}

describe("computePaceStats", () => {
  it("returns zeros with no settled bets", () => {
    const s = computePaceStats([]);
    expect(s.dayCount).toBe(0);
    expect(s.dailyAvg).toBe(0);
    expect(s.yearlyEst).toBe(0);
  });

  it("counts inclusive calendar days and yearly = daily × 365", () => {
    // Activity starts 9 days before "today" → 10 inclusive days
    const now = Date.UTC(2026, 6, 10, 12); // 10 Jul 2026 noon UTC
    const start = Date.UTC(2026, 6, 1, 15); // 1 Jul 2026
    const s = computePaceStats(
      [bet({ id: 1, actualProfit: 100, settledAt: start })],
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
      now
    );
    expect(s.dayCount).toBe(5);
    expect(s.totalProfit).toBe(50);
    expect(s.dailyAvg).toBe(10);
    expect(s.yearlyEst).toBe(3650);
  });
});
