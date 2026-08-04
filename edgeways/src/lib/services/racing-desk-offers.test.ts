import { describe, expect, it, beforeEach } from "vitest";
import { db, offers, offerSeries } from "@/lib/db";
import {
  createOfferSeriesWithInstance,
  syncOfferSeriesInstances,
  type OfferInstanceTemplate,
} from "@/lib/offers/offer-recurrence";
import { isRacingOfferActiveForDate } from "@/lib/services/racing-desk";

const racingTemplate: OfferInstanceTemplate = {
  bookmaker: "Betfair Sportsbook",
  title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
  description: null,
  expectedProfit: 12,
  sport: "horse_racing",
  offerType: "place_refund",
  scopeCourse: "UK & Ireland",
  scopeRaceId: null,
  scopeRaceLabel: null,
  rules: null,
  expiresAt: null,
};

beforeEach(() => {
  db.delete(offers).run();
  db.delete(offerSeries).run();
});

describe("isRacingOfferActiveForDate", () => {
  it("includes today's active racing offer", () => {
    expect(
      isRacingOfferActiveForDate(
        { status: "active", sport: "horse_racing", eventDate: "2026-08-03" },
        "2026-08-03"
      )
    ).toBe(true);
  });

  it("includes a planned dated instance on its future event day", () => {
    expect(
      isRacingOfferActiveForDate(
        { status: "planned", sport: "horse_racing", eventDate: "2026-08-04" },
        "2026-08-04"
      )
    ).toBe(true);
  });

  it("excludes a planned instance when viewing a different day", () => {
    expect(
      isRacingOfferActiveForDate(
        { status: "planned", sport: "horse_racing", eventDate: "2026-08-04" },
        "2026-08-03"
      )
    ).toBe(false);
  });

  it("excludes undated planned offers (avoid showing on every day)", () => {
    expect(
      isRacingOfferActiveForDate(
        { status: "planned", sport: "horse_racing", eventDate: null },
        "2026-08-04"
      )
    ).toBe(false);
  });

  it("keeps undated active offers visible on any day", () => {
    expect(
      isRacingOfferActiveForDate(
        { status: "active", sport: "horse_racing", eventDate: null },
        "2026-08-04"
      )
    ).toBe(true);
  });
});

describe("recurring racing offers on future desk dates", () => {
  it("materialises tomorrow as planned with matching eventDate, and the desk filter accepts it", () => {
    // 2026-08-03 10:00 local.
    const now = new Date(2026, 7, 3, 10, 0, 0).getTime();
    createOfferSeriesWithInstance(racingTemplate, { freq: "daily", interval: 1 }, { now });
    syncOfferSeriesInstances(now);

    const tomorrow = db
      .select()
      .from(offers)
      .all()
      .find((o) => o.instanceDate === "2026-08-04");

    expect(tomorrow).toBeTruthy();
    expect(tomorrow!.status).toBe("planned");
    expect(tomorrow!.eventDate).toBe("2026-08-04");
    expect(isRacingOfferActiveForDate(tomorrow!, "2026-08-04")).toBe(true);
    expect(isRacingOfferActiveForDate(tomorrow!, "2026-08-03")).toBe(false);

    const today = db
      .select()
      .from(offers)
      .all()
      .find((o) => o.instanceDate === "2026-08-03");
    expect(today?.status).toBe("active");
    expect(isRacingOfferActiveForDate(today!, "2026-08-03")).toBe(true);
  });
});
