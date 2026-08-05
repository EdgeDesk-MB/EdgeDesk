import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { accounts, balanceTransactions, db } from "@/lib/db";
import {
  freeBetUsageNote,
  listFreeBetLots,
  selectFreeBetLotForUsage,
} from "./free-bet-lot-balance";

describe("selectFreeBetLotForUsage", () => {
  beforeEach(() => {
    for (const a of db.select().from(accounts).all()) {
      if (!a.name.startsWith("FbPick")) continue;
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

  it("prefers a same-offer promo award over an older void-restore lot", () => {
    // Worked example (Ivybet): £10 void restore still open, then £10 promo
    // awarded on placement for today's qualifier. Convert must spend the promo.
    const bookie = db
      .insert(accounts)
      .values({ name: "FbPick Ivy", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();

    const now = Date.now();
    const voidLot = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Void - stake returned - Winner Regal Desire",
        betId: 100,
        createdAt: now,
        pending: 0,
      })
      .returning()
      .get();
    const promoLot = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement (Qualify · Ivybet)",
        betId: 114,
        createdAt: now + 1,
        pending: 0,
      })
      .returning()
      .get();

    const picked = selectFreeBetLotForUsage(bookie.id, { preferBetIds: [114, 115] });
    expect(picked?.id).toBe(promoLot.id);
    expect(picked?.id).not.toBe(voidLot.id);
    expect(freeBetUsageNote("Convert FB · Ivybet", picked!.id)).toBe(
      `Free bet used - [[lot:${promoLot.id}]] Convert FB · Ivybet`
    );
  });

  it("skips an undersized preferred promo and picks a covering lot", () => {
    const bookie = db
      .insert(accounts)
      .values({ name: "FbPick Short", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();

    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 5,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement",
        betId: 1,
        createdAt: Date.now(),
        pending: 0,
      })
      .run();
    const covering = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 20,
        category: "free_bet",
        note: "Void - stake returned - Other",
        createdAt: Date.now() + 1,
        pending: 0,
      })
      .returning()
      .get();

    // Same-offer promo is only £5; a £10 stake must not target it.
    expect(
      selectFreeBetLotForUsage(bookie.id, { preferBetIds: [1], stake: 10 })?.id
    ).toBe(covering.id);
  });

  it("returns null when no single lot covers the stake (untagged FIFO)", () => {
    const bookie = db
      .insert(accounts)
      .values({ name: "FbPick Split", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();

    const now = Date.now();
    db.insert(balanceTransactions)
      .values([
        {
          accountId: bookie.id,
          amount: 5,
          category: "free_bet",
          note: "Free bet promo - A",
          createdAt: now,
          pending: 0,
        },
        {
          accountId: bookie.id,
          amount: 5,
          category: "free_bet",
          note: "Free bet promo - B",
          createdAt: now + 1,
          pending: 0,
        },
      ])
      .run();

    expect(selectFreeBetLotForUsage(bookie.id, { stake: 12 })).toBeNull();
  });

  it("falls back to newest promo when no offer bet ids match", () => {
    const bookie = db
      .insert(accounts)
      .values({ name: "FbPick Promo", type: "bookie", isActive: 1, createdAt: Date.now() })
      .returning()
      .get();

    const now = Date.now();
    db.insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 10,
        category: "free_bet",
        note: "Void - stake returned - Old",
        createdAt: now,
        pending: 0,
      })
      .run();
    const promo = db
      .insert(balanceTransactions)
      .values({
        accountId: bookie.id,
        amount: 5,
        category: "free_bet",
        note: "Free bet promo - Awarded on placement",
        createdAt: now + 1,
        pending: 0,
      })
      .returning()
      .get();

    expect(selectFreeBetLotForUsage(bookie.id)?.id).toBe(promo.id);
    expect(listFreeBetLots(bookie.id)).toHaveLength(2);
  });
});
