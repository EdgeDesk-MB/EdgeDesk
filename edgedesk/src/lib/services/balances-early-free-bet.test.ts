import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions, bets } from "@/lib/db";
import {
  awardUnconditionalFreeBetEarly,
  getPromoAwardsByBetId,
  ledgerPromoAward,
} from "./balances";

describe("awardUnconditionalFreeBetEarly", () => {
  beforeEach(() => {
    for (const b of db.select().from(bets).all()) {
      if (!b.label.startsWith("EarlyFB")) continue;
      for (const t of db
        .select()
        .from(balanceTransactions)
        .all()
        .filter((tx) => tx.betId === b.id)) {
        db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
      }
      db.delete(bets).where(eq(bets.id, b.id)).run();
    }
    for (const a of db.select().from(accounts).all()) {
      if (a.name !== "EarlyFB Ladbrokes") continue;
      for (const t of db
        .select()
        .from(balanceTransactions)
        .all()
        .filter((tx) => tx.accountId === a.id)) {
        db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
      }
      db.delete(accounts).where(eq(accounts.id, a.id)).run();
    }
  });

  it("credits the free bet while the qual bet is still open", () => {
    const bet = db
      .insert(bets)
      .values({
        label: "EarlyFB Qualify · Ladbrokes",
        market: "win",
        selection: "Yazin",
        betType: "qualifying",
        bookmaker: "EarlyFB Ladbrokes",
        backStake: 10,
        backOdds: 3,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        triggerText: "Bet £10 get £10",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const result = awardUnconditionalFreeBetEarly(bet);
    expect(result).toEqual({ ok: true, amount: 10 });

    const promo = getPromoAwardsByBetId()[bet.id];
    expect(promo).toEqual({ amount: 10, reason: "Awarded on placement" });

    // Settlement must not double-credit
    expect(ledgerPromoAward(bet, 10, "Offer unlocked")).toBe(false);
    expect(awardUnconditionalFreeBetEarly(bet).ok).toBe(false);
  });

  it("rejects place-conditional rewards", () => {
    const bet = db
      .insert(bets)
      .values({
        label: "EarlyFB Place refund",
        market: "win",
        selection: "Yazin",
        betType: "qualifying",
        bookmaker: "EarlyFB Ladbrokes",
        backStake: 10,
        backOdds: 3,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        triggerText: "Bet £10 get £10 FB if 2nd, 3rd, 4th",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    expect(awardUnconditionalFreeBetEarly(bet).ok).toBe(false);
    expect(getPromoAwardsByBetId()[bet.id]).toBeUndefined();
  });

  it("credits from linked offer title when the bet has no trigger text", () => {
    const bet = db
      .insert(bets)
      .values({
        label: "EarlyFB Qualify · Ladbrokes",
        market: "win",
        selection: "Yazin",
        betType: "qualifying",
        bookmaker: "EarlyFB Ladbrokes",
        backStake: 10,
        backOdds: 3,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const result = awardUnconditionalFreeBetEarly(bet, "Bet £10 get £10 free bet");
    expect(result).toEqual({ ok: true, amount: 10 });
    expect(getPromoAwardsByBetId()[bet.id]?.reason).toBe("Awarded on placement");
  });
});
