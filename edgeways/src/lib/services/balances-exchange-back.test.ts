import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions, bets } from "@/lib/db";
import { ensureVenueAccount } from "@/lib/accounts/ensure-venue";
import { getBalanceSummary, ledgerBetPlacement, ledgerBetSettlement } from "./balances";

function cashOf(accountId: number): number {
  return getBalanceSummary().accounts.find((a) => a.id === accountId)?.balance ?? 0;
}

describe("exchange-as-back ledger", () => {
  beforeEach(() => {
    for (const b of db.select().from(bets).all()) {
      if (!b.label.startsWith("ExBack")) continue;
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
      if (a.name !== "TestVenue ExBack") continue;
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

  it("debits the existing exchange wallet, not a new bookie", () => {
    const { account } = ensureVenueAccount("TestVenue ExBack", "exchange");
    db.insert(balanceTransactions)
      .values({
        accountId: account.id,
        amount: 400,
        category: "top_up",
        note: "Seed",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();

    const bet = db
      .insert(bets)
      .values({
        label: "ExBack Hull draw",
        market: "match_odds",
        selection: "draw",
        betType: "qualifying",
        bookmaker: "TestVenue ExBack",
        backStake: 300,
        backOdds: 2.8,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    expect(ledgerBetPlacement(bet)).toBe(true);
    expect(cashOf(account.id)).toBeCloseTo(100, 2);

    const bookies = db
      .select()
      .from(accounts)
      .all()
      .filter((a) => a.name === "TestVenue ExBack" && a.type === "bookie");
    expect(bookies).toHaveLength(0);

    const won = db
      .update(bets)
      .set({ status: "won", balanceLedgered: 1 })
      .where(eq(bets.id, bet.id))
      .returning()
      .get();
    expect(ledgerBetSettlement(won)).toBe(true);
    expect(cashOf(account.id)).toBeCloseTo(940, 2);
  });
});
