import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  accounts,
  balanceTransactions,
  casinoOfferComponents,
  casinoOffers,
  db,
  history,
} from "@/lib/db";
import {
  backfillMissingCasinoOfferBalances,
  casinoSettlementDedupe,
  clearCasinoOfferBalance,
  getSettingsBookies,
  syncCasinoOfferBalance,
} from "@/lib/services/balances";

function wipe() {
  db.delete(balanceTransactions).run();
  db.delete(casinoOfferComponents).run();
  db.delete(casinoOffers).run();
  for (const h of db.select().from(history).all()) {
    if (h.dedupe.startsWith("casino:")) {
      db.delete(history).where(eq(history.id, h.id)).run();
    }
  }
  for (const a of db.select().from(accounts).all()) {
    if (a.name === "PricedUp" || a.name.startsWith("CasinoBal")) {
      db.delete(accounts).where(eq(accounts.id, a.id)).run();
    }
  }
}

function insertOffer(
  partial: Partial<typeof casinoOffers.$inferInsert> & { title: string }
) {
  return db
    .insert(casinoOffers)
    .values({
      casino: "PricedUp",
      bonusAmount: 0,
      wageringMultiplier: 0,
      expectedEv: 0,
      status: "completed",
      actualProfit: 11.31,
      createdAt: Date.now(),
      completedAt: Date.now(),
      ...partial,
    })
    .returning()
    .get();
}

describe("syncCasinoOfferBalance", () => {
  beforeEach(() => wipe());

  it("credits the bookie wallet and writes a History feed row", () => {
    // Wallet moves here; Casino P&L is read from casino_offers.actualProfit.
    const offer = insertOffer({ title: "Spend £30" });
    expect(syncCasinoOfferBalance(offer)).toBe(true);

    const bookie = getSettingsBookies().find((a) => a.name === "PricedUp");
    expect(bookie?.balance).toBeCloseTo(11.31, 2);

    const tx = db
      .select()
      .from(balanceTransactions)
      .all()
      .find((t) => t.casinoOfferId === offer.id);
    expect(tx?.amount).toBeCloseTo(11.31, 2);
    expect(tx?.category).toBe("casino_settlement");
    expect(tx?.affectPnl).toBe(0);
    expect(tx?.note).toContain("Spend £30");

    const feed = db
      .select()
      .from(history)
      .where(eq(history.dedupe, casinoSettlementDedupe(offer.id)))
      .get();
    expect(feed?.kind).toBe("casino_settlement");
    expect(feed?.title).toBe("Casino settled");
    expect(feed?.amount).toBeCloseTo(11.31, 2);
    expect(feed?.detail).toContain("PricedUp");
  });

  it("is idempotent when re-synced", () => {
    const offer = insertOffer({ title: "Reload" });
    syncCasinoOfferBalance(offer);
    syncCasinoOfferBalance(offer);
    const txs = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.casinoOfferId === offer.id);
    expect(txs).toHaveLength(1);
  });

  it("replaces the amount when realised profit changes", () => {
    const offer = insertOffer({ title: "Edit me", actualProfit: 5 });
    syncCasinoOfferBalance(offer);
    const updated = { ...offer, actualProfit: 11.31 };
    syncCasinoOfferBalance(updated);
    const bookie = getSettingsBookies().find((a) => a.name === "PricedUp");
    expect(bookie?.balance).toBeCloseTo(11.31, 2);
  });

  it("clears the wallet row when the campaign is no longer completed", () => {
    const offer = insertOffer({ title: "Reopen" });
    syncCasinoOfferBalance(offer);
    syncCasinoOfferBalance({ ...offer, status: "active" });
    const txs = db
      .select()
      .from(balanceTransactions)
      .all()
      .filter((t) => t.casinoOfferId === offer.id);
    expect(txs).toHaveLength(0);
  });

  it("clears wallet and history on delete helper", () => {
    const offer = insertOffer({ title: "Gone" });
    syncCasinoOfferBalance(offer);
    clearCasinoOfferBalance(offer.id);
    expect(
      db.select().from(balanceTransactions).all().filter((t) => t.casinoOfferId === offer.id)
    ).toHaveLength(0);
    expect(
      db.select().from(history).where(eq(history.dedupe, casinoSettlementDedupe(offer.id))).get()
    ).toBeUndefined();
  });

  it("still writes History when casino name is missing (no wallet move)", () => {
    const offer = insertOffer({ title: "No venue", casino: null });
    expect(syncCasinoOfferBalance(offer)).toBe(true);
    expect(
      db.select().from(balanceTransactions).all().filter((t) => t.casinoOfferId === offer.id)
    ).toHaveLength(0);
    const feed = db
      .select()
      .from(history)
      .where(eq(history.dedupe, casinoSettlementDedupe(offer.id)))
      .get();
    expect(feed?.kind).toBe("casino_settlement");
    expect(feed?.amount).toBeCloseTo(11.31, 2);
  });

  it("backfills completed campaigns that have no ledger row yet", () => {
    insertOffer({ title: "Legacy complete", actualProfit: 8.5 });
    expect(backfillMissingCasinoOfferBalances()).toBe(1);
    expect(backfillMissingCasinoOfferBalances()).toBe(0);
    const bookie = getSettingsBookies().find((a) => a.name === "PricedUp");
    expect(bookie?.balance).toBeCloseTo(8.5, 2);
    expect(
      db
        .select()
        .from(history)
        .all()
        .some((h) => h.kind === "casino_settlement" && h.amount === 8.5)
    ).toBe(true);
  });
});
