import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, accounts, bets, offers } from "@/lib/db";
import { ensureVenueAccount } from "./ensure-venue";
import { renameVenueAccount } from "./rename-venue";

describe("renameVenueAccount", () => {
  beforeEach(() => {
    for (const a of db.select().from(accounts).all()) {
      if (a.name.startsWith("RenameTest")) {
        db.delete(accounts).where(eq(accounts.id, a.id)).run();
      }
    }
    for (const b of db.select().from(bets).all()) {
      if (b.bookmaker?.startsWith("RenameTest")) {
        db.delete(bets).where(eq(bets.id, b.id)).run();
      }
    }
    for (const o of db.select().from(offers).all()) {
      if (o.bookmaker?.startsWith("RenameTest") || o.title.startsWith("RenameTest")) {
        db.delete(offers).where(eq(offers.id, o.id)).run();
      }
    }
  });

  it("cascades bookie rename to bets and offers", () => {
    const { account } = ensureVenueAccount("RenameTest Alpha", "bookie");
    const bet = db
      .insert(bets)
      .values({
        label: "RenameTest bet",
        market: "win",
        selection: "Horse",
        betType: "qualifying",
        bookmaker: "RenameTest Alpha",
        backStake: 10,
        backOdds: 3,
        layStake: 9,
        layOdds: 3.1,
        commission: 0.02,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    const offer = db
      .insert(offers)
      .values({
        title: "RenameTest offer",
        bookmaker: "RenameTest Alpha",
        status: "active",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    const result = renameVenueAccount(account.id, "RenameTest Beta");
    expect(result.betsUpdated).toBe(1);
    expect(result.offersUpdated).toBe(1);
    expect(result.account.name).toBe("RenameTest Beta");

    const updatedBet = db.select().from(bets).where(eq(bets.id, bet.id)).get();
    const updatedOffer = db.select().from(offers).where(eq(offers.id, offer.id)).get();
    expect(updatedBet?.bookmaker).toBe("RenameTest Beta");
    expect(updatedOffer?.bookmaker).toBe("RenameTest Beta");
  });
});
