import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, offers, offerSeries, offerEvSnapshots } from "@/lib/db";
import {
  createOfferSeriesWithInstance,
  deleteOfferWithScope,
  parseSkippedDates,
  syncOfferSeriesInstances,
  type OfferInstanceTemplate,
} from "./offer-recurrence";

const baseTemplate: OfferInstanceTemplate = {
  bookmaker: "Betfair Sportsbook",
  title: "£10 exchange bonus",
  description: null,
  expectedProfit: 8,
  sport: null,
  offerType: null,
  scopeCourse: null,
  scopeRaceId: null,
  scopeRaceLabel: null,
  rules: null,
  expiresAt: null,
};

beforeEach(() => {
  db.delete(offers).run();
  db.delete(offerSeries).run();
});

describe("deleteOfferWithScope", () => {
  it("deletes one occurrence and skips that date so sync does not recreate it", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );

    const before = db.select().from(offers).where(eq(offers.seriesId, seriesId)).all();
    expect(before.length).toBeGreaterThan(1);

    const target = before.find((o) => o.id === offerId)!;
    expect(target.instanceDate).toBe("2026-07-09");

    deleteOfferWithScope(target, "instance");

    expect(db.select().from(offers).where(eq(offers.id, offerId)).get()).toBeUndefined();

    const series = db.select().from(offerSeries).where(eq(offerSeries.id, seriesId)).get();
    expect(series?.recurrenceEnabled).toBe(1);
    expect(parseSkippedDates(series?.skippedDatesJson)).toEqual(["2026-07-09"]);

    syncOfferSeriesInstances(now);
    const after = db.select().from(offers).where(eq(offers.seriesId, seriesId)).all();
    expect(after.some((o) => o.instanceDate === "2026-07-09")).toBe(false);
    expect(after.some((o) => o.instanceDate === "2026-07-10")).toBe(true);
  });

  it("deletes this and future: stops the series and removes empty planned ahead", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );

    const target = db.select().from(offers).where(eq(offers.id, offerId)).get()!;
    deleteOfferWithScope(target, "future");

    expect(db.select().from(offers).where(eq(offers.id, offerId)).get()).toBeUndefined();

    const series = db.select().from(offerSeries).where(eq(offerSeries.id, seriesId)).get();
    expect(series?.recurrenceEnabled).toBe(0);
    expect(series?.recurrenceStoppedFrom).toBe("2026-07-09");

    const remaining = db.select().from(offers).where(eq(offers.seriesId, seriesId)).all();
    expect(remaining.every((o) => (o.instanceDate ?? "") < "2026-07-09")).toBe(true);

    syncOfferSeriesInstances(now);
    expect(db.select().from(offers).where(eq(offers.seriesId, seriesId)).all()).toHaveLength(
      remaining.length
    );
  });

  it("removes EV snapshots when deleting a non-recurring offer", () => {
    const row = db
      .insert(offers)
      .values({
        bookmaker: "Tote",
        title: "One-off",
        expectedProfit: 7.2,
        status: "active",
        createdAt: Date.now(),
      })
      .returning()
      .get();

    db.insert(offerEvSnapshots)
      .values({
        offerId: row.id,
        version: 1,
        lockedAt: Date.now(),
        expectedProfit: 7.2,
        basis: "estimated",
      })
      .run();

    deleteOfferWithScope(row, "instance");

    expect(db.select().from(offers).where(eq(offers.id, row.id)).get()).toBeUndefined();
    expect(
      db.select().from(offerEvSnapshots).where(eq(offerEvSnapshots.offerId, row.id)).all()
    ).toHaveLength(0);
  });
});
