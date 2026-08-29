import { describe, expect, it } from "vitest";
import { listFreeBetLotsFromTransactions } from "./free-bet-lot-math";

function tx(
  partial: Parameters<typeof listFreeBetLotsFromTransactions>[1][number]
): Parameters<typeof listFreeBetLotsFromTransactions>[1][number] {
  return partial;
}

describe("listFreeBetLotsFromTransactions", () => {
  it("keeps a refund-if promo credit open until it is used", () => {
    const lots = listFreeBetLotsFromTransactions(70, [
      tx({
        id: 9,
        accountId: 70,
        amount: 100,
        category: "free_bet",
        pending: 0,
        note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
        createdAt: 1,
        betId: 541,
        expiresAt: null,
      }),
      tx({
        id: 10,
        accountId: 70,
        amount: 25,
        category: "top_up",
        pending: 0,
        note: "ignored",
        createdAt: 2,
        betId: null,
        expiresAt: null,
      }),
    ]);
    expect(lots).toEqual([
      expect.objectContaining({
        id: 9,
        accountId: 70,
        originalAmount: 100,
        remaining: 100,
        betId: 541,
      }),
    ]);
  });

  it("falls back to FIFO when a usage tag points at a missing lot id", () => {
    // Worked: hosted convert tagged [[lot:734]] from SQLite. Neon credit is
    // id 2137. The £50.18 was used; only the later £100 promo stays open.
    const lots = listFreeBetLotsFromTransactions(70, [
      tx({
        id: 2137,
        accountId: 70,
        amount: 50.18,
        category: "free_bet",
        pending: 0,
        note: "Manual free bet top-up",
        createdAt: 1,
        betId: null,
        expiresAt: null,
      }),
      tx({
        id: 2185,
        accountId: 70,
        amount: -50.18,
        category: "free_bet",
        pending: 0,
        note: "Free bet used - [[lot:734]] Convert FB · BetMGM",
        createdAt: 2,
        betId: 503,
        expiresAt: null,
      }),
      tx({
        id: 2282,
        accountId: 70,
        amount: 100,
        category: "free_bet",
        pending: 0,
        note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
        createdAt: 3,
        betId: 541,
        expiresAt: null,
      }),
    ]);
    expect(lots).toEqual([
      expect.objectContaining({
        id: 2282,
        remaining: 100,
        betId: 541,
      }),
    ]);
  });
});
