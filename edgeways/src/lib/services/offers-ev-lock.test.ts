import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, bets, offers, offerEvSnapshots, type OfferRow } from "@/lib/db";
import { listOfferSummaries, summariseOffer } from "./offers";
import { getSnapshotsForOffer, writeEvLock } from "./ev-snapshot";

function insertOffer(
  over: Partial<{ expectedProfit: number | null; status: OfferRow["status"] }> = {}
): OfferRow {
  return db
    .insert(offers)
    .values({
      title: "Bet £10 get £10 FB",
      bookmaker: "Bet365",
      expectedProfit: over.expectedProfit === undefined ? 12.5 : over.expectedProfit,
      status: over.status ?? "active",
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

function lockOffer(offer: OfferRow, expectedProfit: number): void {
  writeEvLock(summariseOffer(offer, [], {}), { expectedProfit });
}

beforeEach(() => {
  db.delete(offerEvSnapshots).run();
  db.delete(bets).run();
  db.delete(offers).run();
});

describe("listOfferSummaries sweep-lock", () => {
  it("locks v1 for an active offer with no snapshot (catch-all for API/recurrence paths)", () => {
    const offer = insertOffer({ expectedProfit: 12.5, status: "active" });

    const summary = listOfferSummaries().find((o) => o.id === offer.id);
    expect(summary?.evLock).not.toBeNull();
    // Explicit expectedProfit, no bets: estimator returns 12.50 with basis "estimated"
    expect(summary?.evLock?.expectedProfit).toBe(12.5);
    expect(summary?.evLock?.basis).toBe("estimated");
    expect(summary?.evLock?.version).toBe(1);
    expect(summary?.evLock?.capturePct).toBeNull();
    expect(getSnapshotsForOffer(offer.id)).toHaveLength(1);
  });

  it("does not lock planned offers", () => {
    const offer = insertOffer({ expectedProfit: 8, status: "planned" });

    const summary = listOfferSummaries().find((o) => o.id === offer.id);
    expect(summary?.evLock).toBeNull();
    expect(getSnapshotsForOffer(offer.id)).toHaveLength(0);
  });

  it("never adds versions when a lock already exists", () => {
    const offer = insertOffer({ expectedProfit: 10, status: "active" });
    lockOffer(offer, 10);

    listOfferSummaries();
    listOfferSummaries();
    const snaps = getSnapshotsForOffer(offer.id);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].version).toBe(1);
  });
});

describe("listOfferSummaries expired fill", () => {
  it("fills an expired unstarted offer with realized 0 (lost EV is real signal)", () => {
    const offer = insertOffer({ expectedProfit: 12.5, status: "active" });
    lockOffer(offer, 12.5);
    db.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id)).run();

    const summary = listOfferSummaries().find((o) => o.id === offer.id);
    expect(summary?.evLock?.realizedProfit).toBe(0);
    // 0 / 12.50 = 0% captured
    expect(summary?.evLock?.capturePct).toBe(0);
    expect(getSnapshotsForOffer(offer.id)[0].settledAt).not.toBeNull();
  });

  it("fills an expired partially-run offer with realized-to-date and commission drag", () => {
    const offer = insertOffer({ expectedProfit: 10, status: "active" });
    lockOffer(offer, 10);
    // Qualifying back £50 @ 8.0 lost, lay £48 @ 8.2 won:
    // actual = 48 × 0.98 − 50 = −£2.96, drag = 48 × 0.02 = £0.96
    db.insert(bets)
      .values({
        label: "Qualifier",
        betType: "qualifying",
        backStake: 50,
        backOdds: 8,
        layStake: 48,
        layOdds: 8.2,
        commission: 0.02,
        status: "lost",
        actualProfit: -2.96,
        offerId: offer.id,
        createdAt: Date.now(),
        settledAt: Date.now(),
      })
      .run();
    db.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id)).run();

    const summary = listOfferSummaries().find((o) => o.id === offer.id);
    expect(summary?.evLock?.realizedProfit).toBeCloseTo(-2.96);
    // -2.96 / 10 = -0.296 capture
    expect(summary?.evLock?.capturePct).toBeCloseTo(-0.296, 3);
    expect(getSnapshotsForOffer(offer.id)[0].commissionDrag).toBeCloseTo(0.96);
  });

  it("defers the expired fill while a leg is still open, then fills with true realized", () => {
    const offer = insertOffer({ expectedProfit: 10, status: "active" });
    lockOffer(offer, 10);
    // Open qualifier carrying a +£4 estimate - must NOT be frozen in as "realized"
    const openBet = db
      .insert(bets)
      .values({
        label: "Qualifier",
        betType: "qualifying",
        backStake: 50,
        backOdds: 8,
        layStake: 48,
        layOdds: 8.2,
        commission: 0.02,
        status: "open",
        expectedProfit: 4,
        offerId: offer.id,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    db.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id)).run();

    listOfferSummaries();
    expect(getSnapshotsForOffer(offer.id)[0].settledAt).toBeNull();

    // Leg settles: back lost, lay won → actual = 48 × 0.98 − 50 = −£2.96
    db.update(bets)
      .set({ status: "lost", actualProfit: -2.96, settledAt: Date.now() })
      .where(eq(bets.id, openBet.id))
      .run();

    const summary = listOfferSummaries().find((o) => o.id === offer.id);
    expect(summary?.evLock?.realizedProfit).toBeCloseTo(-2.96);
    expect(summary?.evLock?.capturePct).toBeCloseTo(-0.296, 3);
  });

  it("does not lock or fill an expired offer that was never locked", () => {
    const offer = insertOffer({ expectedProfit: 5, status: "expired" });

    const summary = listOfferSummaries().find((o) => o.id === offer.id);
    expect(summary?.evLock).toBeNull();
    expect(getSnapshotsForOffer(offer.id)).toHaveLength(0);
  });

  it("fill is idempotent for expired offers", () => {
    const offer = insertOffer({ expectedProfit: 12.5, status: "active" });
    lockOffer(offer, 12.5);
    db.update(offers).set({ status: "expired" }).where(eq(offers.id, offer.id)).run();

    listOfferSummaries();
    const first = getSnapshotsForOffer(offer.id)[0].settledAt;
    listOfferSummaries();
    expect(getSnapshotsForOffer(offer.id)[0].settledAt).toBe(first);
  });
});
