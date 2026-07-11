import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions } from "@/lib/db";
import { listFreeBetLots, removeFreeBetLot, sumFreeBetLotBalance } from "./free-bet-lots";

describe("listFreeBetLots", () => {
  beforeEach(() => {
    for (const a of db.select().from(accounts).all()) {
      if (a.name.startsWith("FbLot")) {
        for (const t of db
          .select()
          .from(balanceTransactions)
          .all()
          .filter((tx) => tx.accountId === a.id)) {
          db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
        }
        db.delete(accounts).where(eq(accounts.id, a.id)).run();
      }
    }
  });

  it("FIFO remaining after free-bet usage", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbLot Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const now = Date.now();
    db.insert(balanceTransactions)
      .values([
        {
          accountId: bookie.id,
          amount: 50,
          category: "free_bet",
          note: "Promo A",
          createdAt: now,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: 20,
          category: "free_bet",
          note: "Promo B",
          createdAt: now + 1,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: -30,
          category: "free_bet",
          note: "Used",
          createdAt: now + 2,
          pending: 0,
        },
      ])
      .run();

    const lots = listFreeBetLots(bookie.id);
    expect(lots).toHaveLength(2);
    expect(lots[0].remaining).toBeCloseTo(20); // 50 - 30
    expect(lots[1].remaining).toBeCloseTo(20);
  });

  it("removeFreeBetLot writes off remaining and drops the lot", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbLot Remove",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const credit = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 50,
        category: "free_bet",
        note: "Manual free bet top-up",
        createdAt: Date.now(),
        pending: 0,
      })
      .returning()
      .get();

    removeFreeBetLot(credit.id);
    expect(listFreeBetLots(bookie.id)).toHaveLength(0);

    const debit = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.accountId === bookie.id && t.amount < 0)
      .at(-1);
    expect(debit?.amount).toBeCloseTo(-50);
    expect(debit?.note).toMatch(/Free bet removed/);
    expect(debit?.note).toMatch(/\[\[lot:\d+\]\]/);
  });

  it("removeFreeBetLot targets the chosen lot, not FIFO older credit", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbLot Target",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const now = Date.now();
    const older = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 50,
        category: "free_bet",
        note: "Older promo",
        createdAt: now,
        pending: 0,
      })
      .returning()
      .get();
    const newer = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 50,
        category: "free_bet",
        note: "Newer promo",
        createdAt: now + 1,
        pending: 0,
      })
      .returning()
      .get();

    removeFreeBetLot(newer.id);
    const lots = listFreeBetLots(bookie.id);
    expect(lots).toHaveLength(1);
    expect(lots[0].id).toBe(older.id);
    expect(lots[0].remaining).toBeCloseTo(50);
  });

  it("sumFreeBetLotBalance reflects open lots when net ledger sum is zero", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbLot NetZero",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const now = Date.now();
    // Historical credits/debits that fully cancel in the ledger…
    const first = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 50,
        category: "free_bet",
        note: "Manual free bet top-up",
        createdAt: now,
        pending: 0,
      })
      .returning()
      .get();
    db.insert(balanceTransactions)
      .values([
        {
          accountId: bookie.id,
          amount: -50,
          category: "free_bet",
          note: `Free bet removed - [[lot:${first.id}]] Manual free bet top-up`,
          createdAt: now + 1,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: 50,
          category: "free_bet",
          note: "Free bet promo - older award",
          createdAt: now + 2,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: -50,
          category: "free_bet",
          note: "Free bet used - older convert",
          createdAt: now + 3,
          pending: 0,
        },
      ])
      .run();
    // …then a fresh promo award is the only open lot.
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 50,
        category: "free_bet",
        note: "Free bet promo - Finished 2nd (promo)",
        betId: 99,
        createdAt: now + 4,
        pending: 0,
      })
      .run();

    const net = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.accountId === bookie.id && t.category === "free_bet")
      .reduce((s, t) => s + t.amount, 0);
    expect(net).toBeCloseTo(0);

    expect(sumFreeBetLotBalance(bookie.id)).toBeCloseTo(50);
    expect(listFreeBetLots(bookie.id)).toHaveLength(1);
  });
});
