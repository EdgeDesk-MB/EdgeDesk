import { describe, expect, it } from "vitest";
import { promoAwardsFromTransactions } from "./promo-awards";

describe("promoAwardsFromTransactions", () => {
  it("keys the first free-bet credit per bet and parses the promo reason", () => {
    const map = promoAwardsFromTransactions([
      {
        category: "free_bet",
        betId: 541,
        amount: 100,
        note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
      },
      {
        category: "free_bet",
        betId: 541,
        amount: 50,
        note: "Free bet promo - ignored duplicate (Goodwood 1:25)",
      },
      { category: "free_bet", betId: 541, amount: -100, note: "Free bet used" },
      { category: "bet_settlement", betId: 541, amount: 65, note: "Lay won" },
      { category: "free_bet", betId: null, amount: 10, note: "orphan" },
    ]);
    expect(map).toEqual({
      541: { amount: 100, reason: "Bet lost — money-back free bet" },
    });
  });

  it("falls back when the note is not a promo sentence", () => {
    const map = promoAwardsFromTransactions([
      { category: "free_bet", betId: 2, amount: 10, note: "Manual free bet" },
    ]);
    expect(map[2]).toEqual({ amount: 10, reason: "Free bet awarded" });
  });
});
