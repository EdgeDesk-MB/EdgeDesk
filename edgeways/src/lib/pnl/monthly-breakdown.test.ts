import { describe, expect, it } from "vitest";
import {
  computeAccountBreakdown,
  computeMethodBreakdown,
  computeMonthlyBreakdown,
} from "@/lib/pnl/monthly-breakdown";
import type { BetRow } from "@/lib/db/schema";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id" | "actualProfit" | "status">): BetRow {
  return {
    eventId: null,
    label: "Bet",
    bookmaker: "Coral",
    exchangeId: null,
    backStake: 10,
    backOdds: 2,
    layStake: 0,
    layOdds: 0,
    commission: 0.02,
    legs: null,
    betType: "qualifying",
    expectedProfit: null,
    settledAt: Date.UTC(2026, 7, 1),
    createdAt: Date.UTC(2026, 7, 1),
    offerId: null,
    triggerText: null,
    triggerRule: null,
    purpose: null,
    source: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    notes: null,
    ewMeta: null,
    ...partial,
  } as BetRow;
}

describe("computeMonthlyBreakdown with casino", () => {
  it("adds casino settlements into the month total alongside bets", () => {
    const rows = computeMonthlyBreakdown(
      [bet({ id: 1, status: "won", actualProfit: 10 })],
      [{ time: Date.UTC(2026, 7, 3), amount: 11.31 }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.key).toBe("2026-08");
    expect(rows[0]!.profit).toBeCloseTo(21.31, 2);
    expect(rows[0]!.betCount).toBe(2);
  });
});

describe("computeAccountBreakdown", () => {
  it("rolls casino profit into the named bookie account", () => {
    const rows = computeAccountBreakdown(
      [bet({ id: 1, status: "won", actualProfit: 5, bookmaker: "PricedUp" })],
      [{ amount: 11.31, casino: "PricedUp" }]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("PricedUp");
    expect(rows[0]!.kind).toBe("bookmaker");
    expect(rows[0]!.profit).toBeCloseTo(16.31, 2);
    expect(rows[0]!.betCount).toBe(2);
  });

  it("attributes matched bets to the bookie, never the lay exchange", () => {
    const rows = computeAccountBreakdown([
      bet({
        id: 1,
        status: "won",
        actualProfit: 12.5,
        bookmaker: "Betfair Sportsbook",
        exchangeId: 1,
        layStake: 9.5,
        layOdds: 3.1,
      }),
      bet({
        id: 2,
        status: "lost",
        actualProfit: -2,
        bookmaker: "Paddy Power",
        exchangeId: 1,
        layStake: 8,
        layOdds: 2.2,
      }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Betfair Sportsbook", "Paddy Power"]);
    expect(rows.every((r) => r.kind === "bookmaker")).toBe(true);
    expect(rows.find((r) => r.name === "Betfair Sportsbook")?.profit).toBeCloseTo(12.5, 2);
    expect(rows.find((r) => r.name === "Paddy Power")?.profit).toBeCloseTo(-2, 2);
  });

  it("never emits exchange rows", () => {
    const rows = computeAccountBreakdown([
      bet({
        id: 1,
        status: "won",
        actualProfit: 5,
        bookmaker: "Coral",
        exchangeId: 99,
        layStake: 4,
      }),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ name: "Coral", kind: "bookmaker", betCount: 1 }),
    ]);
    expect(rows.some((r) => /exchange/i.test(r.name))).toBe(false);
  });
});

describe("computeMethodBreakdown", () => {
  it("rolls boost bets and casino into separate method rows", () => {
    const rows = computeMethodBreakdown(
      [
        bet({ id: 1, status: "won", actualProfit: 8, betType: "boost" }),
        bet({ id: 2, status: "won", actualProfit: 20, betType: "qualifying" }),
        bet({ id: 3, status: "open", actualProfit: null, betType: "boost" }),
      ],
      [{ time: Date.UTC(2026, 7, 3), amount: 11.31 }]
    );
    expect(rows.map((r) => r.key)).toEqual(["casino", "boost"]);
    expect(rows.find((r) => r.key === "boost")).toMatchObject({
      label: "Bet type (Boost only)",
      profit: 8,
      betCount: 1,
    });
    expect(rows.find((r) => r.key === "casino")).toMatchObject({
      label: "Casino",
      profit: 11.31,
      betCount: 1,
    });
  });

  it("omits empty method buckets", () => {
    expect(computeMethodBreakdown([bet({ id: 1, status: "won", actualProfit: 5 })])).toEqual([]);
  });
});
