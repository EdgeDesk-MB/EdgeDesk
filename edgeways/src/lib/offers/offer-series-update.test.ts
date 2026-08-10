import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, bets, offers, offerSeries } from "@/lib/db";
import {
  createOfferSeriesWithInstance,
  syncOfferSeriesTemplateFromOffer,
  type OfferInstanceTemplate,
} from "./offer-recurrence";

const baseTemplate: OfferInstanceTemplate = {
  bookmaker: "Betfair Sportsbook",
  title: "Bet £20 get £20 free bet",
  description: "Singles only",
  expectedProfit: 14,
  sport: "horse_racing",
  offerType: "bet_get_free_place",
  scopeCourse: "uk_ire",
  scopeRaceId: null,
  scopeRaceLabel: null,
  rules: JSON.stringify({ betStake: 20, freeBetAmount: 20, minRunners: 8 }),
  offerUrl: "https://www.betfair.com/promo",
  expiresAt: new Date(2026, 6, 9, 23, 59, 0).getTime(),
};

beforeEach(() => {
  db.delete(bets).run();
  db.delete(offers).run();
  db.delete(offerSeries).run();
});

describe("syncOfferSeriesTemplateFromOffer", () => {
  it("updates the series template and untouched future occurrences", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1, expiryOffsetDays: 0 },
      { now }
    );

    const day2 = db
      .select()
      .from(offers)
      .where(eq(offers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-10");
    expect(day2).toBeTruthy();

    db.update(offers)
      .set({
        title: "Bet £20 get £30 free bet",
        expectedProfit: 21,
        description: "Singles only · cash out",
        rules: JSON.stringify({ betStake: 20, freeBetAmount: 30, minRunners: 8 }),
      })
      .where(eq(offers.id, offerId))
      .run();

    expect(syncOfferSeriesTemplateFromOffer(offerId, now)).toBe(true);

    const series = db.select().from(offerSeries).where(eq(offerSeries.id, seriesId)).get();
    expect(series?.title).toBe("Bet £20 get £30 free bet");
    expect(series?.expectedProfit).toBe(21);
    expect(series?.description).toBe("Singles only · cash out");

    const day2After = db.select().from(offers).where(eq(offers.id, day2!.id)).get();
    expect(day2After?.title).toBe("Bet £20 get £30 free bet");
    expect(day2After?.expectedProfit).toBe(21);
    expect(day2After?.description).toBe("Singles only · cash out");
    expect(day2After?.rules).toContain("30");
  });

  it("leaves occurrences with linked bets alone", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );

    const day2 = db
      .select()
      .from(offers)
      .where(eq(offers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-10")!;

    db.insert(bets)
      .values({
        label: "Q",
        bookmaker: "Betfair Sportsbook",
        betType: "qualifying",
        backStake: 20,
        backOdds: 4,
        status: "open",
        offerId: day2.id,
        createdAt: now,
      })
      .run();

    db.update(offers)
      .set({ title: "Edited seed only for series" })
      .where(eq(offers.id, offerId))
      .run();

    expect(syncOfferSeriesTemplateFromOffer(offerId, now)).toBe(true);

    const day2After = db.select().from(offers).where(eq(offers.id, day2.id)).get();
    expect(day2After?.title).toBe(baseTemplate.title);

    const day3 = db
      .select()
      .from(offers)
      .where(eq(offers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-11");
    expect(day3?.title).toBe("Edited seed only for series");
  });

  it("is a no-op when campaign fields already match the series template", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { offerId } = createOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    expect(syncOfferSeriesTemplateFromOffer(offerId, now)).toBe(false);
  });
});
