import { describe, expect, it } from "vitest";
import { offerFreeBetAmount, offerHasFreeBetReward } from "./offer-ui";
import type { OfferSummary } from "@/lib/services/offers.types";

function offer(partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    id: rest.id,
    bookmaker: rest.bookmaker ?? "Betfair Sportsbook",
    title: rest.title,
    description: rest.description ?? null,
    expectedProfit: rest.expectedProfit ?? null,
    status: rest.status ?? "active",
    sport: rest.sport ?? null,
    offerType: rest.offerType ?? null,
    rules: rest.rules ?? null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    createdAt: Date.now(),
    betCount: 0,
    openBets: 0,
    actualProfit: 0,
    expectedFromBets: 0,
    profit: {
      qualifyingProfit: 0,
      qualifyingSettledCount: 0,
      qualifyingOpenCount: 0,
      freeBetAwarded: false,
      freeBetAwardAmount: null,
      freeBetAwardReason: null,
      freeBetStage: "none",
      freeBetProfit: 0,
      freeBetOpenCount: 0,
      freeBetSettledCount: 0,
      openExpectedProfit: 0,
      totalProfit: 0,
      ...profitPartial,
    },
  };
}

describe("offerHasFreeBetReward", () => {
  it("detects structured place-refund free bet offers", () => {
    expect(
      offerHasFreeBetReward(
        offer({
          id: 1,
          title: "Bet £50 get £50 free if places 3, 4",
          offerType: "bet_get_free_place",
          rules: JSON.stringify({
            type: "bet_get_free_place",
            minRunners: 8,
            regions: ["GB"],
            qualifyingPlaces: [3, 4],
            betStake: 50,
            freeBetAmount: 50,
          }),
        })
      )
    ).toBe(true);
  });

  it("rejects generic promos that only mention free bet in description", () => {
    expect(
      offerHasFreeBetReward(
        offer({
          id: 2,
          title: "ON ANY GOLF THIS WEEKEND",
          offerType: "promo_terms",
          description: "Place a free bet on any golf market",
        })
      )
    ).toBe(false);
  });

  it("rejects money-back style offers", () => {
    expect(
      offerHasFreeBetReward(
        offer({
          id: 3,
          title: "Money Back 2nd & 3rd",
          offerType: "promo_terms",
        })
      )
    ).toBe(false);
  });

  it("detects free bet from title wording", () => {
    expect(
      offerHasFreeBetReward(
        offer({
          id: 4,
          title: "Bet £10 get £10 free bet — Cricket",
        })
      )
    ).toBe(true);
    expect(offerFreeBetAmount(offer({ id: 4, title: "Bet £10 get £10 free bet — Cricket" }))).toBe(10);
  });
});
