import { describe, expect, it } from "vitest";
import { ukDateTimeToUtcMs } from "@/lib/offers/offer-expiry";
import {
  OFFER_EXPIRY_LEAD_MS,
  OFFER_RACE_LEAD_MS,
  isOfferImpactAlertDue,
  offerExpiringAlertCopy,
  resolveOfferImpact,
  type OfferImpactOffer,
} from "./offer-impact";

const MIN = 60_000;
/** 2026-08-02 11:27 UK (create time for Galway paste). */
const CREATE = ukDateTimeToUtcMs("2026-08-02", 11, 27)!;
const FIRST_OFF = ukDateTimeToUtcMs("2026-08-02", 14, 0)!;
const EXPIRES = ukDateTimeToUtcMs("2026-08-02", 23, 59)!;

const galway: OfferImpactOffer = {
  id: 9,
  title: "Bet £5 get £5 free bet",
  sport: "horse_racing",
  eventDate: "2026-08-02",
  scopeCourse: "Galway",
  scopeRaceId: null,
  scopeRaceLabel: null,
  expiresAt: EXPIRES,
};

describe("resolveOfferImpact", () => {
  it("uses the first matching course race when present", () => {
    const impact = resolveOfferImpact(galway, [
      { course: "Chester", offTime: FIRST_OFF - 60 * MIN },
      { course: "Galway", offTime: FIRST_OFF },
      { course: "Galway", offTime: FIRST_OFF + 30 * MIN },
    ]);
    expect(impact).toMatchObject({ at: FIRST_OFF, source: "course", label: "Galway" });
  });

  it("prefers Offer Edge startTime when named", () => {
    const edgeAt = FIRST_OFF + 45 * MIN;
    const impact = resolveOfferImpact(galway, [{ course: "Galway", offTime: FIRST_OFF }], edgeAt);
    expect(impact).toMatchObject({ at: edgeAt, source: "edge" });
  });

  it("falls back to hard expiry when no course races are known yet", () => {
    const impact = resolveOfferImpact(galway, []);
    expect(impact).toMatchObject({ at: EXPIRES, source: "expiry" });
  });

  it("uses hard expiry for convert_free_bet even when course races exist", () => {
    const impact = resolveOfferImpact(
      galway,
      [{ course: "Galway", offTime: FIRST_OFF }],
      null,
      "convert_free_bet"
    );
    expect(impact).toMatchObject({ at: EXPIRES, source: "expiry" });
  });

  it("uses the race-scoped off time from the label", () => {
    const impact = resolveOfferImpact(
      {
        ...galway,
        scopeRaceId: "race-1",
        scopeRaceLabel: "14:00 · Feature",
      },
      []
    );
    expect(impact?.source).toBe("race");
    expect(impact?.at).toBe(FIRST_OFF);
  });
});

describe("isOfferImpactAlertDue", () => {
  it("stays quiet at create time when Galway is hours away", () => {
    const impact = resolveOfferImpact(galway, [{ course: "Galway", offTime: FIRST_OFF }])!;
    expect(isOfferImpactAlertDue(impact, CREATE, EXPIRES)).toBe(false);
  });

  it("fires inside the 15-minute race lead", () => {
    const impact = resolveOfferImpact(galway, [{ course: "Galway", offTime: FIRST_OFF }])!;
    expect(isOfferImpactAlertDue(impact, FIRST_OFF - OFFER_RACE_LEAD_MS, EXPIRES)).toBe(true);
    expect(isOfferImpactAlertDue(impact, FIRST_OFF - 5 * MIN, EXPIRES)).toBe(true);
  });

  it("fires once the meeting is under way while the promo is still open", () => {
    const impact = resolveOfferImpact(galway, [{ course: "Galway", offTime: FIRST_OFF }])!;
    expect(isOfferImpactAlertDue(impact, FIRST_OFF + 20 * MIN, EXPIRES)).toBe(true);
  });

  it("uses the 2-hour expiry lead when only a hard deadline is known", () => {
    const impact = resolveOfferImpact(galway, [])!;
    expect(isOfferImpactAlertDue(impact, CREATE, EXPIRES)).toBe(false);
    expect(
      isOfferImpactAlertDue(impact, EXPIRES - OFFER_EXPIRY_LEAD_MS, EXPIRES)
    ).toBe(true);
  });
});

describe("offerExpiringAlertCopy", () => {
  it("names the course and minutes before the off", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 3.6,
      offerTitle: "Bet £5 get £5 free bet",
      impact: { at: FIRST_OFF, source: "course", label: "Galway" },
      now: FIRST_OFF - 15 * MIN,
    });
    expect(copy.title).toBe("Galway off in 15 min - £4 unclaimed");
    expect(copy.body).toMatch(/before the off/i);
  });
});
