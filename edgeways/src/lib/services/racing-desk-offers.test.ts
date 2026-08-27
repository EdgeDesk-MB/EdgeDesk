import { describe, expect, it, beforeEach } from "vitest";
import { db, offers, offerSeries, type OfferRow } from "@/lib/db";
import {
  createOfferSeriesWithInstance,
  syncOfferSeriesInstances,
  type OfferInstanceTemplate,
} from "@/lib/offers/offer-recurrence";
import {
  freeBetPlaceTagsFromLinkedBets,
  isRacingDeskOffer,
  isRacingOfferActiveForDate,
  selectActiveRacingOffers,
} from "@/lib/services/racing-desk";
import type { RacingDeskRace } from "@/lib/racing-desk/types";

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
  offerUrl: null,
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

  it("keeps undated active offers visible on any day when no expiry window", () => {
    expect(
      isRacingOfferActiveForDate(
        { status: "active", sport: "horse_racing", eventDate: null },
        "2026-08-04"
      )
    ).toBe(true);
  });

  it("shows once-only offers on each desk day from Starts through Expires", () => {
    const expiresAt = new Date(2026, 7, 9, 19, 0, 0).getTime();
    const base = {
      status: "active" as const,
      sport: "horse_racing" as const,
      eventDate: null,
      startsOn: "2026-08-08",
      expiresAt,
    };
    expect(isRacingOfferActiveForDate(base, "2026-08-07")).toBe(false);
    expect(isRacingOfferActiveForDate(base, "2026-08-08")).toBe(true);
    expect(isRacingOfferActiveForDate(base, "2026-08-09")).toBe(true);
    expect(isRacingOfferActiveForDate(base, "2026-08-10")).toBe(false);
  });

  it("does not let Starts→Expires override a pinned racing day", () => {
    expect(
      isRacingOfferActiveForDate(
        {
          status: "active",
          sport: "horse_racing",
          eventDate: "2026-08-08",
          startsOn: "2026-08-08",
          expiresAt: new Date(2026, 7, 9, 19, 0, 0).getTime(),
        },
        "2026-08-09"
      )
    ).toBe(false);
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

describe("isRacingDeskOffer", () => {
  it("includes place-refund offers for the racing day", () => {
    expect(
      isRacingDeskOffer(
        {
          status: "active",
          sport: "horse_racing",
          eventDate: "2026-08-08",
          offerType: "bet_get_free_place",
          rules: JSON.stringify({
            type: "bet_get_free_place",
            minRunners: 8,
            regions: ["GB", "IRE"],
            qualifyingPlaces: [2, 3, 4],
            betStake: 20,
            freeBetAmount: 20,
          }),
        },
        "2026-08-08"
      )
    ).toBe(true);
  });

  it("includes straight bet&get across Starts→Expires without a racing-day pin", () => {
    const offer = {
      status: "active" as const,
      sport: "horse_racing" as const,
      eventDate: null,
      startsOn: "2026-08-08",
      expiresAt: new Date(2026, 7, 9, 19, 0, 0).getTime(),
      offerType: "bet_get_free_place",
      rules: JSON.stringify({
        type: "bet_get_free_place",
        minRunners: 8,
        regions: ["GB", "IRE"],
        qualifyingPlaces: [],
        betStake: 10,
        freeBetAmount: 10,
      }),
    };
    expect(isRacingDeskOffer(offer, "2026-08-08")).toBe(true);
    expect(isRacingDeskOffer(offer, "2026-08-09")).toBe(true);
    expect(isRacingDeskOffer(offer, "2026-08-10")).toBe(false);
  });
});

describe("selectActiveRacingOffers", () => {
  const today: OfferRow = {
    id: 289,
    bookmaker: "Betfair Sportsbook",
    title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
    description: null,
    expectedProfit: null,
    status: "planned",
    expiresAt: 1787862600000,
    createdAt: 1,
    completedAt: null,
    seriesId: null,
    instanceDate: "2026-08-27",
    startsOn: null,
    source: null,
    offerUrl: null,
    sport: "horse_racing",
    offerType: "bet_get_free_place",
    scopeCourse: "uk_ire",
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: "2026-08-27",
    rules: JSON.stringify({
      type: "bet_get_free_place",
      minRunners: 8,
      regions: ["GB", "IRE"],
      qualifyingPlaces: [2, 3, 4],
      betStake: 20,
      freeBetAmount: 20,
    }),
  };
  const tomorrow = { ...today, id: 290, eventDate: "2026-08-28", instanceDate: "2026-08-28" };
  const football = { ...today, id: 1, sport: "football" as const, eventDate: null };

  it("keeps today's planned place-refund even when the list is injected (hosted Neon)", () => {
    const picked = selectActiveRacingOffers([today, tomorrow, football], "2026-08-27");
    expect(picked.map((o) => o.id)).toEqual([289]);
  });

  it("drops a campaign once a bet is already linked", () => {
    const picked = selectActiveRacingOffers(
      [today],
      "2026-08-27",
      new Set([289])
    );
    expect(picked).toEqual([]);
  });
});

describe("freeBetPlaceTagsFromLinkedBets", () => {
  const placeOffer: OfferRow = {
    id: 83,
    bookmaker: "Betfair Sportsbook",
    title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
    description: null,
    expectedProfit: 12,
    status: "completed",
    expiresAt: null,
    createdAt: Date.now(),
    completedAt: Date.now(),
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: null,
    sport: "horse_racing",
    offerType: "bet_get_free_place",
    scopeCourse: "all",
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: "2026-08-06",
    rules: JSON.stringify({
      type: "bet_get_free_place",
      minRunners: 8,
      regions: ["GB", "IRE"],
      qualifyingPlaces: [2, 3, 4],
      betStake: 20,
      freeBetAmount: 20,
    }),
  };

  const race = {
    externalId: "race-1",
    course: "Southwell (AW)",
    fieldSize: 8,
    region: "GB",
    offTime: "18:41",
  } as Omit<RacingDeskRace, "offerTags">;

  it("builds hatch tags from completed offer-linked bets on past races", () => {
    const tags = freeBetPlaceTagsFromLinkedBets(
      race,
      [{ offerId: 83 }],
      new Map([[83, placeOffer]]),
      "2026-08-06"
    );
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({
      offerId: 83,
      qualifies: true,
      qualifyingPlaces: [2, 3, 4],
    });
    expect(tags[0]!.suggestedRunners).toBeUndefined();
  });

  it("uses persisted rules for hatch places (title repair is a separate pass)", () => {
    const edited: OfferRow = {
      ...placeOffer,
      title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
      rules: JSON.stringify({
        type: "bet_get_free_place",
        minRunners: 8,
        regions: ["GB", "IRE"],
        qualifyingPlaces: [2],
        betStake: 20,
        freeBetAmount: 20,
        winnerMustBeSpFavourite: true,
      }),
    };
    const tags = freeBetPlaceTagsFromLinkedBets(
      race,
      [{ offerId: 83 }],
      new Map([[83, edited]]),
      "2026-08-06"
    );
    expect(tags[0]?.qualifyingPlaces).toEqual([2]);
    expect(tags[0]?.winnerMustBeSpFavourite).toBe(true);
  });

  it("skips bets without an offerId or place rules", () => {
    expect(
      freeBetPlaceTagsFromLinkedBets(race, [{ offerId: null }], new Map([[83, placeOffer]]), "2026-08-06")
    ).toEqual([]);
    expect(
      freeBetPlaceTagsFromLinkedBets(
        race,
        [{ offerId: 99 }],
        new Map([[99, { ...placeOffer, id: 99, rules: null, offerType: null }]]),
        "2026-08-06"
      )
    ).toEqual([]);
  });
});
