import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, balanceTransactions } from "@/lib/db";
import { listFreeBetLots, removeFreeBetLot, setFreeBetLotExpiry, sumFreeBetLotBalance } from "./free-bet-lots";

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

  it("setFreeBetLotExpiry stores and clears the deadline on the credit", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbLot Expiry",
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
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Offer unlocked",
        createdAt: Date.now(),
        pending: 0,
      })
      .returning()
      .get();

    expect(listFreeBetLots(bookie.id)[0]?.expiresAt).toBeNull();
    const at = Date.now() + 86_400_000;
    setFreeBetLotExpiry(credit.id, at);
    expect(listFreeBetLots(bookie.id)[0]?.expiresAt).toBe(at);
    setFreeBetLotExpiry(credit.id, null);
    expect(listFreeBetLots(bookie.id)[0]?.expiresAt).toBeNull();
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

    // Backdated well before "now" - removeFreeBetLot stamps its debit with a
    // real Date.now(), which must land safely after both synthetic credits.
    const now = Date.now() - 1000;
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

  it("sumFreeBetLotBalance keeps a fresh award open after historical credits/debits cancel", () => {
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

    const historicalNet = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.accountId === bookie.id && t.category === "free_bet")
      .reduce((s, t) => s + t.amount, 0);
    expect(historicalNet).toBeCloseTo(0);

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

    expect(sumFreeBetLotBalance(bookie.id)).toBeCloseTo(50);
    expect(listFreeBetLots(bookie.id)).toHaveLength(1);
  });

  it("an over-drawn historical debit does not eat a later top-up", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbLot Overdraw",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const now = Date.now();
    // A credit fully used up, then a *second* undirected debit for which no
    // lot was open at the time (e.g. a duplicated "convert to cash" debit).
    db.insert(balanceTransactions)
      .values([
        {
          accountId: bookie.id,
          amount: 50,
          category: "free_bet",
          note: "Free bet promo - award",
          createdAt: now,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: -50,
          category: "free_bet",
          note: "Free bet used - convert",
          createdAt: now + 1,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: -50,
          category: "free_bet",
          note: "Free bet used - convert (duplicate)",
          createdAt: now + 2,
          pending: 0,
        },
      ])
      .run();

    // Days later, a fresh manual top-up is added - it must stay open, not be
    // retroactively consumed by the earlier over-drawn debit.
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 20,
        category: "free_bet",
        note: "Manual free bet top-up",
        createdAt: now + 1000 * 60 * 60 * 24 * 5,
        pending: 0,
      })
      .run();

    expect(sumFreeBetLotBalance(bookie.id)).toBeCloseTo(20);
    expect(listFreeBetLots(bookie.id)).toHaveLength(1);
    expect(listFreeBetLots(bookie.id)[0].remaining).toBeCloseTo(20);
  });
});
