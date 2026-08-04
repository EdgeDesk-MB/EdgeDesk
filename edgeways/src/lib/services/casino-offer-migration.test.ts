import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, casinoOfferComponents, casinoOffers, runCasinoOfferComponentsBackfill } from "@/lib/db";

function reset() {
  db.delete(casinoOfferComponents).run();
  db.delete(casinoOffers).run();
}

function legacyOffer(overrides: Partial<typeof casinoOffers.$inferInsert> = {}) {
  return db
    .insert(casinoOffers)
    .values({
      casino: "Test Casino",
      title: "Legacy £20 bonus, 35x wagering",
      bonusAmount: 20,
      wageringMultiplier: 35,
      rtp: 0.96,
      contributionPct: 1,
      status: "active",
      expectedEv: -8,
      game: "Starburst",
      createdAt: Date.now(),
      ...overrides,
    })
    .returning()
    .get();
}

describe("K1 backfillLegacyCasinoOffers (pre-existing casino offer → one bonus component)", () => {
  beforeEach(reset);

  it("backfills a legacy row into one bonus-type component with matching values and EV", () => {
    const offer = legacyOffer();

    const backfilled = runCasinoOfferComponentsBackfill();
    expect(backfilled).toBe(1);

    const components = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, offer.id))
      .all();
    expect(components).toHaveLength(1);
    const [c] = components;
    expect(c.componentType).toBe("bonus");
    expect(c.amount).toBe(20);
    expect(c.wageringMultiplier).toBe(35);
    expect(c.rtp).toBe(0.96);
    expect(c.contributionPct).toBe(1);
    expect(c.game).toBe("Starburst");
    expect(c.expectedEv).toBe(-8);
    expect(c.sortOrder).toBe(0);
  });

  it("is idempotent - a second run backfills nothing further", () => {
    legacyOffer();
    expect(runCasinoOfferComponentsBackfill()).toBe(1);
    expect(runCasinoOfferComponentsBackfill()).toBe(0);
  });

  it("leaves a campaign that already has a component untouched", () => {
    const offer = legacyOffer();
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offer.id,
        componentType: "cash",
        amount: 15,
        expectedEv: 15,
        sortOrder: 0,
        createdAt: Date.now(),
      })
      .run();

    const backfilled = runCasinoOfferComponentsBackfill();
    expect(backfilled).toBe(0);

    const components = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, offer.id))
      .all();
    expect(components).toHaveLength(1);
    expect(components[0].componentType).toBe("cash");
  });

  it("never backfills a fresh K1 empty campaign (bonus_amount 0 is not a legacy row)", () => {
    // What POST /api/casino inserts for a brand-new campaign: zero legacy
    // columns, zero components. Must NOT be mistaken for an unmigrated
    // pre-K1 offer on a later server restart / backfill re-run.
    legacyOffer({ bonusAmount: 0, wageringMultiplier: 0, expectedEv: 0, rtp: null, game: null });

    expect(runCasinoOfferComponentsBackfill()).toBe(0);
  });

  it("backfills multiple orphaned campaigns independently, each with its own values", () => {
    const a = legacyOffer({ bonusAmount: 20, expectedEv: -8, wageringMultiplier: 35 });
    const b = legacyOffer({ bonusAmount: 50, expectedEv: 40, wageringMultiplier: 10, rtp: 0.98 });

    expect(runCasinoOfferComponentsBackfill()).toBe(2);

    const aComponents = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, a.id))
      .all();
    const bComponents = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, b.id))
      .all();
    expect(aComponents[0].amount).toBe(20);
    expect(aComponents[0].expectedEv).toBe(-8);
    expect(bComponents[0].amount).toBe(50);
    expect(bComponents[0].expectedEv).toBe(40);
    expect(bComponents[0].rtp).toBe(0.98);
  });
});
