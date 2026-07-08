import { describe, expect, it } from "vitest";
import { computeOfferProfitBreakdown } from "./offers";
import type { BetRow } from "@/lib/db";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id">): BetRow {
  return {
    eventId: null,
    label: "Test",
    market: "win",
    selection: "Horse",
    betType: "qualifying",
    bookmaker: "Betfair Sportsbook",
    exchangeId: null,
    backStake: 50,
    backOdds: 8,
    layStake: 48,
    layOdds: 8.2,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: "Bet £50 get £50 FB if 2nd, 3rd, 4th",
    triggerRule: null,
    status: "lost",
    expectedProfit: 32,
    actualProfit: -1.51,
    notes: null,
    balanceLedgered: 1,
    balanceSettled: 1,
    createdAt: 1,
    settledAt: 2,
    offerId: 1,
    ...partial,
  };
}

describe("computeOfferProfitBreakdown", () => {
  it("splits qualifying loss from free bet conversion profit", () => {
    const linked = [
      bet({ id: 1, betType: "qualifying", actualProfit: -1.51, status: "lost" }),
      bet({
        id: 2,
        betType: "free_snr",
        actualProfit: 42,
        status: "won",
        triggerText: null,
      }),
    ];
    const promo = { 1: { amount: 50, reason: "Finished 3rd" } };

    const breakdown = computeOfferProfitBreakdown(linked, promo);

    expect(breakdown.qualifyingProfit).toBe(-1.51);
    expect(breakdown.freeBetAwarded).toBe(true);
    expect(breakdown.freeBetAwardAmount).toBe(50);
    expect(breakdown.freeBetProfit).toBe(42);
    expect(breakdown.totalProfit).toBeCloseTo(40.49);
    expect(breakdown.freeBetStage).toBe("settled");
  });

  it("shows awarded but unused free bet", () => {
    const linked = [bet({ id: 1, actualProfit: -1.51, status: "lost" })];
    const promo = { 1: { amount: 50, reason: "Finished 2nd" } };

    const breakdown = computeOfferProfitBreakdown(linked, promo);

    expect(breakdown.freeBetAwarded).toBe(true);
    expect(breakdown.freeBetProfit).toBe(0);
    expect(breakdown.totalProfit).toBe(-1.51);
    expect(breakdown.freeBetStage).toBe("awarded");
  });

  it("shows not awarded when qualifying settled without promo", () => {
    const linked = [bet({ id: 1, actualProfit: -2, status: "lost", triggerText: "2nd, 3rd, 4th" })];

    const breakdown = computeOfferProfitBreakdown(linked, {});

    expect(breakdown.freeBetAwarded).toBe(false);
    expect(breakdown.freeBetStage).toBe("not_awarded");
    expect(breakdown.totalProfit).toBe(-2);
  });
});
