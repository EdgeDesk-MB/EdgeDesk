import { describe, expect, it } from "vitest";
import {
  countRecommendedOffersOnRace,
  countRecommendedRaces,
  edgePlayForRaceOffer,
  findOfferTag,
  offerTagBestEv,
  offerTagDisplayEv,
  qualifyingOfferTags,
} from "@/lib/racing/offer-tags";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import type { RaceOfferTag } from "@/lib/racing-desk/types";

function tag(partial: Partial<RaceOfferTag> & Pick<RaceOfferTag, "offerId" | "offerTitle">): RaceOfferTag {
  return {
    qualifies: true,
    score: 50,
    summary: "",
    ...partial,
  };
}

function play(partial: Partial<OfferEdgePlay> & Pick<OfferEdgePlay, "offerId" | "raceExternalId" | "totalEv">): OfferEdgePlay {
  return {
    offerTitle: "Offer",
    bookmaker: "Betfair Sportsbook",
    course: "Goodwood",
    raceName: "Handicap",
    offTime: "13:50",
    startTime: 0,
    fieldSize: 15,
    runner: {
      horseId: "h1",
      name: "Edge Horse",
      backDecimal: 6.5,
      layDecimal: 6.8,
      marketRank: 1,
    },
    triggerProb: 0.2,
    triggerBasis: "model",
    qualLoss: -1.2,
    layStake: 48,
    freeBetEv: 10,
    retention: 0.8,
    retentionSampleSize: 0,
    confidence: "mixed",
    reasons: ["Tight lay"],
    warnings: [],
    ...partial,
  };
}

describe("qualifyingOfferTags", () => {
  it("sorts by best runner EV then score", () => {
    const race = {
      offerTags: [
        tag({
          offerId: 1,
          offerTitle: "Lower EV",
          score: 90,
          suggestedRunners: [{ horseId: "a", name: "A", score: 1, summary: "", totalEv: 2, marketRank: 1 }],
        }),
        tag({
          offerId: 2,
          offerTitle: "Higher EV",
          score: 40,
          suggestedRunners: [{ horseId: "b", name: "B", score: 1, summary: "", totalEv: 8, marketRank: 1 }],
        }),
        tag({
          offerId: 3,
          offerTitle: "Does not qualify",
          qualifies: false,
          suggestedRunners: [{ horseId: "c", name: "C", score: 1, summary: "", totalEv: 99, marketRank: 1 }],
        }),
      ],
    };

    const sorted = qualifyingOfferTags(race);
    expect(sorted.map((t) => t.offerId)).toEqual([2, 1]);
    expect(offerTagBestEv(sorted[0]!)).toBe(8);
  });

  it("falls back to score when EV missing", () => {
    const race = {
      offerTags: [
        tag({ offerId: 1, offerTitle: "A", score: 10 }),
        tag({ offerId: 2, offerTitle: "B", score: 80 }),
      ],
    };
    expect(qualifyingOfferTags(race).map((t) => t.offerId)).toEqual([2, 1]);
  });

  it("prefers Offer Edge EV over heuristic when plays are supplied", () => {
    const race = {
      externalId: "race-1",
      offerTags: [
        tag({
          offerId: 1,
          offerTitle: "Heuristic winner",
          suggestedRunners: [{ horseId: "a", name: "A", score: 1, summary: "", totalEv: 20, marketRank: 2 }],
        }),
        tag({
          offerId: 2,
          offerTitle: "Edge winner",
          suggestedRunners: [{ horseId: "b", name: "B", score: 1, summary: "", totalEv: 1, marketRank: 1 }],
        }),
      ],
    };
    const plays = [
      play({ offerId: 1, raceExternalId: "race-1", totalEv: 3 }),
      play({ offerId: 2, raceExternalId: "race-1", totalEv: 12 }),
    ];
    expect(qualifyingOfferTags(race, plays).map((t) => t.offerId)).toEqual([2, 1]);
  });
});

describe("findOfferTag", () => {
  it("returns specific offer or best when id omitted", () => {
    const race = {
      offerTags: [
        tag({
          offerId: 1,
          offerTitle: "A",
          suggestedRunners: [{ horseId: "a", name: "A", score: 1, summary: "", totalEv: 1, marketRank: 1 }],
        }),
        tag({
          offerId: 2,
          offerTitle: "B",
          suggestedRunners: [{ horseId: "b", name: "B", score: 1, summary: "", totalEv: 5, marketRank: 1 }],
        }),
      ],
    };
    expect(findOfferTag(race, 1)?.offerId).toBe(1);
    expect(findOfferTag(race, null)?.offerId).toBe(2);
  });
});

describe("edge desk helpers", () => {
  it("resolves play and display EV", () => {
    const plays = [play({ offerId: 9, raceExternalId: "r1", totalEv: 4.5 })];
    const found = edgePlayForRaceOffer(plays, "r1", 9);
    expect(found?.totalEv).toBe(4.5);
    expect(offerTagDisplayEv(tag({ offerId: 9, offerTitle: "X" }), found)).toBe(4.5);
  });

  it("counts recommended races and offers", () => {
    const plays = [
      play({ offerId: 1, raceExternalId: "a", totalEv: 1 }),
      play({ offerId: 2, raceExternalId: "a", totalEv: 2 }),
      play({ offerId: 1, raceExternalId: "b", totalEv: 3 }),
    ];
    expect(countRecommendedRaces(plays, [{ externalId: "a" }, { externalId: "b" }, { externalId: "c" }])).toBe(2);
    expect(countRecommendedOffersOnRace(plays, "a")).toBe(2);
    expect(countRecommendedOffersOnRace(plays, "c")).toBe(0);
  });
});
