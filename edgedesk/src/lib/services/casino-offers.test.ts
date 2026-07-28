import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, casinoOfferComponents, casinoOffers } from "@/lib/db";
import { getCasinoOfferSummaries, getCasinoOfferSummary } from "./casino-offers";

function reset() {
  db.delete(casinoOfferComponents).run();
  db.delete(casinoOffers).run();
}

function campaign(title: string) {
  return db
    .insert(casinoOffers)
    .values({
      casino: "Test Casino",
      title,
      bonusAmount: 0,
      wageringMultiplier: 0,
      status: "active",
      expectedEv: 0,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function component(
  casinoOfferId: number,
  overrides: Partial<typeof casinoOfferComponents.$inferInsert> = {}
) {
  return db
    .insert(casinoOfferComponents)
    .values({
      casinoOfferId,
      componentType: "cash",
      amount: 10,
      expectedEv: 10,
      sortOrder: 0,
      createdAt: Date.now(),
      ...overrides,
    })
    .returning()
    .get();
}

describe("getCasinoOfferSummaries / getCasinoOfferSummary", () => {
  beforeEach(reset);

  it("sums a Grosvenor-shape campaign's components to the correct total EV", () => {
    const offer = campaign("20 Free Spins when you play £100");
    component(offer.id, {
      componentType: "qualifying_wager",
      amount: 100,
      rtp: 0.96,
      expectedEv: -4,
      sortOrder: 0,
    });
    component(offer.id, {
      componentType: "free_spins",
      spins: 20,
      spinValue: 0.4,
      rtp: 0.95,
      expectedEv: 7.6,
      sortOrder: 1,
    });

    const summary = getCasinoOfferSummary(offer.id);
    expect(summary).not.toBeNull();
    expect(summary!.expectedEv).toBe(3.6);
    expect(summary!.components).toHaveLength(2);
    expect(summary!.components.map((c) => c.componentType)).toEqual([
      "qualifying_wager",
      "free_spins",
    ]);
  });

  it("orders components by sortOrder, not insertion order", () => {
    const offer = campaign("Out-of-order components");
    component(offer.id, { sortOrder: 1, expectedEv: 1 });
    component(offer.id, { sortOrder: 0, expectedEv: 2 });

    const summary = getCasinoOfferSummary(offer.id);
    expect(summary!.components.map((c) => c.sortOrder)).toEqual([0, 1]);
  });

  it("a campaign with zero components has EV 0 and an empty list (valid intermediate state)", () => {
    const offer = campaign("Just created, nothing logged yet");
    const summary = getCasinoOfferSummary(offer.id);
    expect(summary!.components).toEqual([]);
    expect(summary!.expectedEv).toBe(0);
  });

  it("evBasis is heuristic if any component has no rtp, estimated otherwise", () => {
    const offer = campaign("Mixed basis");
    component(offer.id, { componentType: "cash", amount: 10, expectedEv: 10, rtp: null });
    let summary = getCasinoOfferSummary(offer.id);
    expect(summary!.evBasis).toBe("heuristic");

    const offer2 = campaign("All entered");
    component(offer2.id, { componentType: "bonus", amount: 10, rtp: 0.96, expectedEv: 5 });
    summary = getCasinoOfferSummary(offer2.id);
    expect(summary!.evBasis).toBe("estimated");
  });

  it("getCasinoOfferSummaries returns every campaign, newest first", () => {
    const a = campaign("Older");
    const b = campaign("Newer");
    db.update(casinoOffers).set({ createdAt: 1000 }).where(eq(casinoOffers.id, a.id)).run();
    db.update(casinoOffers).set({ createdAt: 2000 }).where(eq(casinoOffers.id, b.id)).run();

    const summaries = getCasinoOfferSummaries();
    expect(summaries.map((s) => s.title)).toEqual(["Newer", "Older"]);
  });

  it("getCasinoOfferSummary returns null for an unknown id", () => {
    expect(getCasinoOfferSummary(999999)).toBeNull();
  });
});
