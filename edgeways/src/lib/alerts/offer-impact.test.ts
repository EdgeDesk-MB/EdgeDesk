import { describe, expect, it } from "vitest";
import { ukDateTimeToUtcMs } from "@/lib/offers/offer-expiry";
import { formatClockString } from "@/lib/time-format";
import {
  OFFER_EXPIRY_LEAD_MS,
  OFFER_RACE_LEAD_MS,
  alertCopyAmounts,
  isOfferImpactAlertDue,
  offerExpiringAlertCopy,
  resolveOfferImpact,
  type OfferImpact,
  type OfferImpactOffer,
} from "./offer-impact";

const MIN = 60_000;
/** 2026-08-02 11:27 UK (create time for Galway paste). */
const CREATE = ukDateTimeToUtcMs("2026-08-02", 11, 27)!;
const FIRST_OFF = ukDateTimeToUtcMs("2026-08-02", 14, 0)!;
const EXPIRES = ukDateTimeToUtcMs("2026-08-02", 23, 59)!;
const CLOCK_1400 = formatClockString("14:00");

const placeRules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3, 4],
  betStake: 5,
  freeBetAmount: 5,
});

const galway: OfferImpactOffer = {
  id: 9,
  title: "Bet £5 get £5 free bet",
  sport: "horse_racing",
  eventDate: "2026-08-02",
  scopeCourse: "Galway",
  scopeRaceId: null,
  scopeRaceLabel: null,
  expiresAt: EXPIRES,
  offerType: "bet_get_free_place",
  rules: placeRules,
};

function impact(over: Partial<OfferImpact> & Pick<OfferImpact, "at" | "source">): OfferImpact {
  return {
    label: null,
    raceClockHhmm: null,
    firstOffHhmm: null,
    scopedRaceCount: null,
    qualifyingRaceCount: null,
    ...over,
  };
}

describe("resolveOfferImpact", () => {
  it("uses the first matching course race when present", () => {
    const resolved = resolveOfferImpact(galway, [
      { course: "Chester", offTime: FIRST_OFF - 60 * MIN, fieldSize: 12 },
      { course: "Galway", offTime: FIRST_OFF, fieldSize: 12 },
      { course: "Galway", offTime: FIRST_OFF + 30 * MIN, fieldSize: 6 },
      { course: "Galway", offTime: FIRST_OFF + 60 * MIN, fieldSize: 10 },
    ]);
    expect(resolved).toMatchObject({
      at: FIRST_OFF,
      source: "course",
      label: "Galway",
      firstOffHhmm: "14:00",
      scopedRaceCount: 3,
      qualifyingRaceCount: 2,
      raceClockHhmm: null,
    });
  });

  it("joins multi-course labels and counts races across both", () => {
    const resolved = resolveOfferImpact(
      { ...galway, scopeCourse: "Galway, Goodwood" },
      [
        { course: "Galway", offTime: FIRST_OFF, fieldSize: 12 },
        { course: "Galway", offTime: FIRST_OFF + 30 * MIN, fieldSize: 10 },
        { course: "Goodwood", offTime: FIRST_OFF + 15 * MIN, fieldSize: 9 },
      ]
    );
    expect(resolved?.label).toBe("Galway & Goodwood");
    expect(resolved?.scopedRaceCount).toBe(3);
    expect(resolved?.qualifyingRaceCount).toBe(3);
  });

  it("prefers Offer Edge startTime when named", () => {
    const edgeAt = FIRST_OFF + 45 * MIN;
    const resolved = resolveOfferImpact(
      galway,
      [{ course: "Galway", offTime: FIRST_OFF, fieldSize: 12 }],
      edgeAt
    );
    expect(resolved).toMatchObject({
      at: edgeAt,
      source: "edge",
      label: "Galway",
      qualifyingRaceCount: 1,
    });
  });

  it("ignores Offer Edge startTime for non-horse-racing offers", () => {
    const edgeAt = FIRST_OFF + 45 * MIN;
    const resolved = resolveOfferImpact(
      {
        ...galway,
        sport: "football",
        scopeCourse: null,
        offerType: "general",
        rules: null,
      },
      [{ course: "Galway", offTime: FIRST_OFF, fieldSize: 12 }],
      edgeAt
    );
    expect(resolved).toMatchObject({ at: EXPIRES, source: "expiry" });
    expect(resolved?.qualifyingRaceCount).toBeNull();
  });

  it("falls back to hard expiry when no course races are known yet", () => {
    const resolved = resolveOfferImpact(galway, []);
    expect(resolved).toMatchObject({ at: EXPIRES, source: "expiry" });
  });

  it("uses hard expiry for convert_free_bet even when course races exist", () => {
    const resolved = resolveOfferImpact(
      galway,
      [{ course: "Galway", offTime: FIRST_OFF, fieldSize: 12 }],
      null,
      "convert_free_bet"
    );
    expect(resolved).toMatchObject({ at: EXPIRES, source: "expiry" });
  });

  it("uses the race-scoped off time from the label", () => {
    const resolved = resolveOfferImpact(
      {
        ...galway,
        scopeRaceId: "race-1",
        scopeRaceLabel: "14:00 · Feature",
      },
      [{ course: "Galway", offTime: FIRST_OFF, fieldSize: 12, externalId: "race-1" }]
    );
    expect(resolved).toMatchObject({
      source: "race",
      at: FIRST_OFF,
      label: "Galway",
      raceClockHhmm: "14:00",
      firstOffHhmm: "14:00",
      scopedRaceCount: 1,
      qualifyingRaceCount: 1,
    });
  });
});

describe("isOfferImpactAlertDue", () => {
  it("stays quiet at create time when Galway is hours away", () => {
    const resolved = resolveOfferImpact(galway, [
      { course: "Galway", offTime: FIRST_OFF, fieldSize: 12 },
    ])!;
    expect(isOfferImpactAlertDue(resolved, CREATE, EXPIRES)).toBe(false);
  });

  it("fires inside the 15-minute race lead", () => {
    const resolved = resolveOfferImpact(galway, [
      { course: "Galway", offTime: FIRST_OFF, fieldSize: 12 },
    ])!;
    expect(isOfferImpactAlertDue(resolved, FIRST_OFF - OFFER_RACE_LEAD_MS, EXPIRES)).toBe(true);
    expect(isOfferImpactAlertDue(resolved, FIRST_OFF - 5 * MIN, EXPIRES)).toBe(true);
  });

  it("fires once the meeting is under way while the promo is still open", () => {
    const resolved = resolveOfferImpact(galway, [
      { course: "Galway", offTime: FIRST_OFF, fieldSize: 12 },
    ])!;
    expect(isOfferImpactAlertDue(resolved, FIRST_OFF + 20 * MIN, EXPIRES)).toBe(true);
  });

  it("uses the 2-hour expiry lead when only a hard deadline is known", () => {
    const resolved = resolveOfferImpact(galway, [])!;
    expect(isOfferImpactAlertDue(resolved, CREATE, EXPIRES)).toBe(false);
    expect(
      isOfferImpactAlertDue(resolved, EXPIRES - OFFER_EXPIRY_LEAD_MS, EXPIRES)
    ).toBe(true);
  });
});

describe("alertCopyAmounts", () => {
  it("reads stake and free-bet amount from rules", () => {
    expect(
      alertCopyAmounts({
        offer: galway,
        offerTitle: galway.title,
      })
    ).toEqual({ stake: 5, freeBetAmount: 5 });
  });

  it("prefers convert-lot remaining for free-bet amount", () => {
    expect(
      alertCopyAmounts({
        offer: galway,
        convertLotRemaining: 8.5,
      })
    ).toEqual({ stake: 5, freeBetAmount: 8.5 });
  });
});

describe("offerExpiringAlertCopy", () => {
  it("says the course starts, with stake, first race and qualifying race count", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 3.6,
      offerTitle: "Bet £5 get £5 free bet",
      impact: impact({
        at: FIRST_OFF,
        source: "course",
        label: "Galway",
        firstOffHhmm: "14:00",
        scopedRaceCount: 7,
        qualifyingRaceCount: 5,
      }),
      now: FIRST_OFF - 15 * MIN,
      bookmaker: "Betfred",
      actionKind: "place_qualifying",
      stake: 5,
    });
    expect(copy.title).toBe("⚡ £4 edge · Galway starts in 15 minutes");
    expect(copy.body).toBe(
      `Bet £5 get £5 free bet · place the £5 qualifying bet · first race ${CLOCK_1400} · 5 races qualify`
    );
  });

  it("singularises a one-minute countdown", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 4,
      offerTitle: "Bet £5 get £5 free bet",
      impact: impact({
        at: FIRST_OFF,
        source: "course",
        label: "Galway",
        firstOffHhmm: "14:00",
      }),
      now: FIRST_OFF - 60_000,
      actionKind: "place_qualifying",
      stake: 5,
    });
    expect(copy.title).toBe("⚡ £4 edge · Galway starts in 1 minute");
  });

  it("uses Meeting starts with open clock and qualify count when regional", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 12,
      offerTitle: "Bet £10 get £10",
      impact: impact({
        at: FIRST_OFF,
        source: "edge",
        firstOffHhmm: "14:00",
        qualifyingRaceCount: 18,
      }),
      now: FIRST_OFF - 15 * MIN,
      bookmaker: "Bet365",
      actionKind: "place_qualifying",
      stake: 10,
    });
    expect(copy.title).toBe("⚡ £12 edge · Meeting starts in 15 minutes");
    expect(copy.body).toBe(
      `Bet £10 get £10 · place the £10 qualifying bet · opens ${CLOCK_1400} · 18 races qualify`
    );
  });

  it("names course and race clock for a race-locked offer", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 8,
      offerTitle: "Bet £20 get £10",
      impact: impact({
        at: FIRST_OFF,
        source: "race",
        label: "Galway",
        raceClockHhmm: "14:00",
        firstOffHhmm: "14:00",
        scopedRaceCount: 1,
        qualifyingRaceCount: 1,
      }),
      now: FIRST_OFF - 15 * MIN,
      bookmaker: "Coral",
      actionKind: "place_qualifying",
      stake: 20,
    });
    expect(copy.title).toBe(`⚡ £8 edge · Galway ${CLOCK_1400} starts in 15 minutes`);
    expect(copy.body).toBe(
      `Bet £20 get £10 · place the £20 qualifying bet · on the ${CLOCK_1400}`
    );
  });

  it("uses plural start and qualify count across multi-course", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 15,
      offerTitle: "Bet £10 get £10",
      impact: impact({
        at: FIRST_OFF,
        source: "course",
        label: "Galway & Goodwood",
        firstOffHhmm: "14:00",
        scopedRaceCount: 12,
        qualifyingRaceCount: 9,
      }),
      now: FIRST_OFF - 15 * MIN,
      bookmaker: "Paddy Power",
      actionKind: "place_qualifying",
      stake: 10,
    });
    expect(copy.title).toBe("⚡ £15 edge · Galway & Goodwood start in 15 minutes");
    expect(copy.body).toBe(
      `Bet £10 get £10 · place the £10 qualifying bet · first race ${CLOCK_1400} · 9 races qualify across Galway & Goodwood`
    );
  });

  it("personalises under-way copy for a course meeting", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 4,
      offerTitle: "Bet £5 get £5 free bet",
      impact: impact({
        at: FIRST_OFF,
        source: "course",
        label: "Galway",
        firstOffHhmm: "14:00",
        scopedRaceCount: 5,
        qualifyingRaceCount: 5,
      }),
      now: FIRST_OFF + 20 * MIN,
      bookmaker: "Betfred",
      actionKind: "place_qualifying",
      stake: 5,
    });
    expect(copy.title).toBe("⚡ £4 edge · Galway under way");
    expect(copy.body).toBe(
      "Bet £5 get £5 free bet · finish the £5 qualifying bet while Galway is live · 5 races qualify"
    );
  });

  it("falls back to scoped race count when qualify count is unknown", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 4,
      offerTitle: "Boosted odds special",
      impact: impact({
        at: FIRST_OFF,
        source: "course",
        label: "Ascot",
        firstOffHhmm: "15:30",
        scopedRaceCount: 6,
        qualifyingRaceCount: null,
      }),
      now: FIRST_OFF - 10 * MIN,
      bookmaker: "Bet365",
      actionKind: "place_qualifying",
      stake: null,
    });
    expect(copy.body).toBe(
      `Boosted odds special · place the qualifying bet · first race ${formatClockString("15:30")} · 6 races`
    );
  });

  it("keeps ends terminology for a hard promo deadline, with stake", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 12,
      offerTitle: "Bet £10 get £10",
      impact: impact({ at: EXPIRES, source: "expiry" }),
      now: EXPIRES - 90 * MIN,
      bookmaker: "Bet365",
      actionKind: "place_qualifying",
      stake: 10,
    });
    expect(copy.title).toMatch(/⚡ £12 edge ends in/i);
    expect(copy.body).toMatch(
      /^Bet £10 get £10 · place the £10 qualifying bet before /
    );
  });

  it("tailors convert_free_bet expiry copy with free-bet amount", () => {
    const copy = offerExpiringAlertCopy({
      remainingEv: 9,
      offerTitle: "Free bet £10",
      impact: impact({ at: EXPIRES, source: "expiry" }),
      now: EXPIRES - 90 * MIN,
      bookmaker: "Sky Bet",
      actionKind: "convert_free_bet",
      freeBetAmount: 10,
    });
    expect(copy.title).toMatch(/⚡ £9 edge ends in/i);
    expect(copy.body).toMatch(/^Free bet £10 · convert the £10 free bet before /);
  });
});
