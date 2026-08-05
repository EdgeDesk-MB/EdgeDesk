import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { accounts, balanceTransactions, bets, db, offers } from "@/lib/db";
import { listFreeBetLots } from "@/lib/accounts/free-bet-lot-balance";
import { ledgerBetPlacement, ledgerBetSettlement } from "./balances";

/**
 * Worked example matching the Ivybet bug:
 * 1. Stale £10 void-restore lot still open
 * 2. New £10 promo awarded on placement for offer O
 * 3. Convert free_snr on offer O must debit [[lot:promo]], not the void lot
 * 4. Voiding a free_snr restores by deleting the usage debit (no new orphan lot)
 */
describe("free-bet lot targeting + void restore", () => {
  beforeEach(() => {
    for (const b of db.select().from(bets).all()) {
      if (!b.label.startsWith("FbTarget")) continue;
      for (const t of db
        .select()
        .from(balanceTransactions)
        .all()
        .filter((tx) => tx.betId === b.id)) {
        db.delete(balanceTransactions).where(eq(balanceTransactions.id, t.id)).run();
      }
      db.delete(bets).where(eq(bets.id, b.id)).run();
    }
    for (const o of db.select().from(offers).all()) {
      if (!o.title.startsWith("FbTarget")) continue;
      db.delete(offers).where(eq(offers.id, o.id)).run();
    }
    for (const a of db.select().from(accounts).all()) {
      if (a.name !== "FbTarget Bookie") continue;
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

  it("convert spends the offer promo lot, not an older void-restore lot", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbTarget Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const offer = db
      .insert(offers)
      .values({
        bookmaker: "FbTarget Bookie",
        title: "FbTarget Bet £10 get £10",
        status: "active",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const now = Date.now();
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Void - stake returned - Winner Regal Desire",
        createdAt: now,
        pending: 0,
      })
      .run();

    const qual = db
      .insert(bets)
      .values({
        label: "FbTarget Qualify",
        market: "win",
        selection: "Horse",
        betType: "qualifying",
        bookmaker: "FbTarget Bookie",
        backStake: 10,
        backOdds: 3,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "lost",
        offerId: offer.id,
        balanceLedgered: 1,
        balanceSettled: 1,
        createdAt: now + 1,
      })
      .returning()
      .get();

    const promo = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement (FbTarget Qualify)",
        betId: qual.id,
        createdAt: now + 2,
        pending: 0,
      })
      .returning()
      .get();

    const convert = db
      .insert(bets)
      .values({
        label: "FbTarget Convert",
        market: "win",
        selection: "Horse",
        betType: "free_snr",
        bookmaker: "FbTarget Bookie",
        backStake: 10,
        backOdds: 5,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        offerId: offer.id,
        createdAt: now + 3,
      })
      .returning()
      .get();

    expect(ledgerBetPlacement(convert)).toBe(true);

    const usage = db
      .select()
      .from(balanceTransactions)
      .all()
      .find((t) => t.betId === convert.id && t.category === "free_bet" && t.amount < 0);
    expect(usage?.note).toBe(`Free bet used - [[lot:${promo.id}]] FbTarget Convert`);

    const lots = listFreeBetLots(bookie.id);
    expect(lots).toHaveLength(1);
    expect(lots[0]?.note).toMatch(/Void - stake returned/);
    expect(lots[0]?.remaining).toBeCloseTo(10);
  });

  it("re-void after reopen does not invent a free-bet credit", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbTarget Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement",
        createdAt: Date.now(),
        pending: 0,
      })
      .run();

    const convert = db
      .insert(bets)
      .values({
        label: "FbTarget Revoid",
        market: "win",
        selection: "Horse",
        betType: "free_snr",
        bookmaker: "FbTarget Bookie",
        backStake: 10,
        backOdds: 4,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    ledgerBetPlacement(convert);
    const once = db
      .update(bets)
      .set({ status: "void", balanceLedgered: 1 })
      .where(eq(bets.id, convert.id))
      .returning()
      .get();
    expect(ledgerBetSettlement(once)).toBe(true);

    // Simulate PATCH reopen: clear balanceSettled, leave balanceLedgered set.
    const reopened = db
      .update(bets)
      .set({ status: "void", balanceSettled: 0, balanceLedgered: 1 })
      .where(eq(bets.id, convert.id))
      .returning()
      .get();
    expect(ledgerBetSettlement(reopened)).toBe(true);

    const credits = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter(
        (t) =>
          t.accountId === bookie.id &&
          t.category === "free_bet" &&
          t.amount > 0 &&
          (t.note?.includes("Void - stake returned") ?? false)
      );
    expect(credits).toHaveLength(0);
    expect(listFreeBetLots(bookie.id)[0]?.remaining).toBeCloseTo(10);
  });

  it("voiding a free_snr deletes the usage debit instead of creating an orphan credit", () => {
    const bookie = db
      .insert(accounts)
      .values({
        name: "FbTarget Bookie",
        type: "bookie",
        isActive: 1,
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const promo = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement",
        createdAt: Date.now(),
        pending: 0,
      })
      .returning()
      .get();

    const convert = db
      .insert(bets)
      .values({
        label: "FbTarget VoidConvert",
        market: "win",
        selection: "Horse",
        betType: "free_snr",
        bookmaker: "FbTarget Bookie",
        backStake: 10,
        backOdds: 4,
        layStake: 0,
        layOdds: 0,
        commission: 0,
        status: "open",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    ledgerBetPlacement(convert);
    expect(listFreeBetLots(bookie.id)).toHaveLength(0);

    const voided = db
      .update(bets)
      .set({ status: "void", balanceLedgered: 1 })
      .where(eq(bets.id, convert.id))
      .returning()
      .get();

    expect(ledgerBetSettlement(voided)).toBe(true);

    const txs = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.accountId === bookie.id && t.category === "free_bet");
    expect(txs.some((t) => t.amount < 0)).toBe(false);
    expect(txs.some((t) => t.note?.includes("Void - stake returned"))).toBe(false);

    const lots = listFreeBetLots(bookie.id);
    expect(lots).toHaveLength(1);
    expect(lots[0]?.id).toBe(promo.id);
    expect(lots[0]?.remaining).toBeCloseTo(10);
  });
});
