import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions, bets } from "@/lib/db";
import {
  getBalanceSummary,
  ledgerBetPlacement,
  reledgerOpenBetPlacement,
} from "./balances";
import { sumFreeBetLotBalance } from "@/lib/accounts/free-bet-lot-balance";

function cashOf(accountId: number): number {
  return getBalanceSummary().accounts.find((a) => a.id === accountId)?.balance ?? 0;
}

/**
 * Worked example: open £10 cash no-lay on "Reledger Bookie" (wallet £100 cash,
 * £25 free bet). Flip to free_snr: cash must unlock (+£10) and free-bet wallet
 * must debit (−£10). Flip back: reverse.
 */
describe("reledgerOpenBetPlacement - cash ↔ free no-lay", () => {
  beforeEach(() => {
    for (const b of db.select().from(bets).all()) {
      if (!b.label.startsWith("Reledger")) continue;
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
      if (a.name !== "Reledger Bookie") continue;
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

  function seedWallet() {
    const account = db
      .insert(accounts)
      .values({
        name: "Reledger Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    db.insert(balanceTransactions)
      .values({
        accountId: account.id,
        amount: 100,
        category: "top_up",
        note: "Seed cash",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();
    db.insert(balanceTransactions)
      .values({
        accountId: account.id,
        amount: 25,
        category: "free_bet",
        note: "Seed free bet",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();
    return account;
  }

  it("moves a £10 debit from cash to free bet when betType flips to free_snr", () => {
    const account = seedWallet();
    const cashBet = db
      .insert(bets)
      .values({
        label: "Reledger cash no-lay",
        market: "win",
        selection: "Horse",
        betType: "qualifying",
        bookmaker: "Reledger Bookie",
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

    expect(ledgerBetPlacement(cashBet)).toBe(true);
    expect(cashOf(account.id)).toBeCloseTo(90, 2);
    expect(sumFreeBetLotBalance(account.id)).toBeCloseTo(25, 2);

    const freeBet = db
      .update(bets)
      .set({ betType: "free_snr", balanceLedgered: 1 })
      .where(eq(bets.id, cashBet.id))
      .returning()
      .get();

    reledgerOpenBetPlacement(cashBet, freeBet);

    expect(cashOf(account.id)).toBeCloseTo(100, 2);
    expect(sumFreeBetLotBalance(account.id)).toBeCloseTo(15, 2);

    const placement = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.betId === cashBet.id);
    expect(placement).toHaveLength(1);
    expect(placement[0]).toMatchObject({
      category: "free_bet",
      amount: -10,
    });
  });

  it("restores cash debit when flipping free_snr back to qualifying", () => {
    const account = seedWallet();
    const freeBet = db
      .insert(bets)
      .values({
        label: "Reledger free no-lay",
        market: "win",
        selection: "Horse",
        betType: "free_snr",
        bookmaker: "Reledger Bookie",
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

    expect(ledgerBetPlacement(freeBet)).toBe(true);
    expect(sumFreeBetLotBalance(account.id)).toBeCloseTo(15, 2);

    const cashBet = db
      .update(bets)
      .set({ betType: "qualifying", balanceLedgered: 1 })
      .where(eq(bets.id, freeBet.id))
      .returning()
      .get();

    reledgerOpenBetPlacement(freeBet, cashBet);

    expect(cashOf(account.id)).toBeCloseTo(90, 2);
    expect(sumFreeBetLotBalance(account.id)).toBeCloseTo(25, 2);
  });

  it("does not delete a promo free-bet credit on the same bet id", () => {
    const account = seedWallet();
    const bet = db
      .insert(bets)
      .values({
        label: "Reledger with promo",
        market: "win",
        selection: "Horse",
        betType: "qualifying",
        bookmaker: "Reledger Bookie",
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

    ledgerBetPlacement(bet);
    db.insert(balanceTransactions)
      .values({
        accountId: account.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement",
        betId: bet.id,
        createdAt: Date.now(),
        pending: 0,
      })
      .run();

    const next = db
      .update(bets)
      .set({ betType: "free_snr", backStake: 10 })
      .where(eq(bets.id, bet.id))
      .returning()
      .get();

    reledgerOpenBetPlacement(bet, next);

    const promo = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.betId === bet.id && t.category === "free_bet" && t.amount > 0);
    expect(promo).toHaveLength(1);
    expect(promo[0]!.amount).toBe(10);
  });
});
