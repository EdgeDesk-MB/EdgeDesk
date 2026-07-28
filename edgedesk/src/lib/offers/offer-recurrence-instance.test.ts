import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, offers, offerSeries } from "@/lib/db";
import { createOfferSeriesWithInstance, type OfferInstanceTemplate } from "./offer-recurrence";

const baseTemplate: OfferInstanceTemplate = {
  bookmaker: "Betfair Sportsbook",
  title: "Bet £50 get £20 free bet",
  description: null,
  expectedProfit: 13.5,
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

describe("createOfferSeriesWithInstance - first occurrence anchoring", () => {
  it("snaps the first occurrence to the next matching weekday instead of creation day", () => {
    // 2026-07-09 is a Thursday.
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "weekly", interval: 1, byWeekday: [3] },
      { now }
    );
    const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
    expect(offer?.instanceDate).toBe("2026-07-15");
    expect(offer?.status).toBe("planned");
  });

  it("fires immediately when the rule already matches the creation day", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
    expect(offer?.instanceDate).toBe("2026-07-09");
    expect(offer?.status).toBe("active");
  });

  it("anchors on an explicit startsOn date further out than the next natural match", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "weekly", interval: 1, byWeekday: [3] },
      { now, startsOn: "2026-07-22" }
    );
    const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
    expect(offer?.instanceDate).toBe("2026-07-22");
  });

  it("applies expiryOffsetDays to the materialised instance's expiry", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const templateExpiresAt = new Date(2026, 6, 9, 23, 59, 0).getTime();
    const { offerId } = createOfferSeriesWithInstance(
      { ...baseTemplate, expiresAt: templateExpiresAt },
      { freq: "weekly", interval: 1, byWeekday: [3], expiryOffsetDays: 6 },
      { now }
    );
    const offer = db.select().from(offers).where(eq(offers.id, offerId)).get();
    // First Wednesday is 2026-07-15; +6 days = 2026-07-21 at 23:59 (a "valid for 7 days" promo).
    const d = new Date(offer!.expiresAt!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
  });
});
