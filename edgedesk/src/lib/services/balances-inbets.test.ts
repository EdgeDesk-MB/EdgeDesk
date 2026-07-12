import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions, bets } from "@/lib/db";
import { getBalanceSummary, getOpenInBetsTotal, openBetInBetsAmount } from "./balances";

describe("openBetInBetsAmount", () => {
  it("counts lay liability for free SNR (back stake not cash)", () => {
    expect(
      openBetInBetsAmount({
        status: "open",
        balanceLedgered: 1,
        betType: "free_snr",
        backStake: 50,
        layStake: 40,
        layOdds: 9.5,
      })
    ).toBeCloseTo(340); // 40 * 8.5
  });

  it("counts cash back stake + liability for qualifying", () => {
    expect(
      openBetInBetsAmount({
        status: "open",
        balanceLedgered: 1,
        betType: "qualifying",
        backStake: 50,
        layStake: 46.61,
        layOdds: 5.9,
      })
    ).toBeCloseTo(50 + 46.61 * 4.9);
  });

  it("ignores settled or unledgered bets", () => {
    expect(
      openBetInBetsAmount({
        status: "lost",
        balanceLedgered: 1,
        betType: "qualifying",
        backStake: 50,
        layStake: 40,
        layOdds: 5,
      })
    ).toBe(0);
    expect(
      openBetInBetsAmount({
        status: "open",
        balanceLedgered: 0,
        betType: "qualifying",
        backStake: 50,
        layStake: 40,
        layOdds: 5,
      })
    ).toBe(0);
  });
});

describe("getOpenInBetsTotal / bankroll fields", () => {
  beforeEach(() => {
    for (const a of db.select().from(accounts).all()) {
      if (!a.name.startsWith("InBet")) continue;
      for (const t of db
        .select()
        .from(balanceTransactions)
        .all()
        .filter((tx) => tx.accountId === a.id)) {
        db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
      }
      db.delete(accounts).where(eq(accounts.id, a.id)).run();
    }
    for (const b of db.select().from(bets).all()) {
      if (!b.label.startsWith("InBet")) continue;
      db.delete(bets).where(eq(bets.id, b.id)).run();
    }
  });

  it("counts open lay liability as in-bets (free SNR excludes back stake)", () => {
    const exchange = db
      .insert(accounts)
      .values({
        name: "InBet Exchange",
        type: "exchange",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    db.insert(balanceTransactions)
      .values({
        accountId: exchange.id,
        amount: 500,
        category: "top_up",
        note: "Seed",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();

    db.insert(bets)
      .values({
        label: "InBet open lay",
        market: "win",
        selection: "Horse",
        betType: "free_snr",
        bookmaker: "InBet Bookie",
        exchangeId: null,
        backStake: 50,
        backOdds: 8.5,
        layStake: 40,
        layOdds: 9.5,
        commission: 0.02,
        status: "open",
        balanceLedgered: 1,
        balanceSettled: 0,
        createdAt: Date.now(),
      })
      .run();

    // Free SNR: back not in cash in-bets; liability = 40 * 8.5 = 340
    expect(getOpenInBetsTotal()).toBeCloseTo(340);

    const summary = getBalanceSummary();
    expect(summary.inBets).toBeCloseTo(340);
    expect(summary.bankroll).toBeCloseTo(summary.total + summary.inBets);
  });
});
