import { describe, expect, it } from "vitest";
import { deriveTrackBetAction, qualifyingOfferTriggerText } from "./offer-track-bet";
import type { OfferSummary } from "@/lib/services/offers.types";

function offer(
  partial: Omit<Partial<OfferSummary>, "profit"> &
    Pick<OfferSummary, "id" | "title"> & {
      profit?: Partial<OfferSummary["profit"]>;
    }
): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    id: rest.id,
    bookmaker: rest.bookmaker ?? "Betfair Sportsbook",
    title: rest.title,
    description: null,
    expectedProfit: null,
    status: rest.status ?? "active",
    sport: rest.sport ?? "horse_racing",
    offerType: rest.offerType ?? "bet_get_free_place",
    rules: rest.rules ?? null,
    scopeCourse: rest.scopeCourse ?? "Newmarket",
    scopeRaceId: rest.scopeRaceId ?? null,
    scopeRaceLabel: rest.scopeRaceLabel ?? null,
    eventDate: rest.eventDate ?? null,
    expiresAt: null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    createdAt: Date.now(),
    betCount: rest.betCount ?? 0,
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

const rules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [3, 4],
  betStake: 50,
  freeBetAmount: 50,
});

describe("deriveTrackBetAction", () => {
  it("prefills qualifying stake and bookie for new campaigns", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 1,
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        rules,
        betCount: 0,
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Place qualifying bet");
    expect(action.prefill?.betType).toBe("qualifying");
    expect(action.prefill?.backStake).toBe(50);
    expect(action.prefill?.bookmaker).toBe("Betfair Sportsbook");
    expect(action.prefill?.offerId).toBe(1);
    expect(action.prefill?.triggerText).toMatch(/Bet £50/);
  });

  it("prefills Offer trigger from title for General bet&get campaigns", () => {
    const general = offer({
      id: 10,
      title: "Bet £10 get £10 free bet",
      bookmaker: "Ivybet",
      sport: "general",
      offerType: "promo_terms",
      rules: JSON.stringify({
        type: "promo_terms",
        minOdds: 2,
        importantNotes: "SNR (stake not returned) · SNR free bet",
      }),
      betCount: 0,
      scopeCourse: null,
    });
    expect(qualifyingOfferTriggerText(general)).toBe("Bet £10 get £10 free bet");
    const action = deriveTrackBetAction(general);
    expect(action.enabled).toBe(true);
    expect(action.prefill?.betType).toBe("qualifying");
    expect(action.prefill?.offerId).toBe(10);
    expect(action.prefill?.bookmaker).toBe("Ivybet");
    expect(action.prefill?.triggerText).toBe("Bet £10 get £10 free bet");
  });

  it("prefills free bet conversion when awarded", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 2,
        title: "Bet £50 get £50 free bet",
        rules,
        betCount: 1,
        profit: {
          qualifyingSettledCount: 1,
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 50,
        },
      })
    );
    expect(action.enabled).toBe(true);
    expect(action.label).toBe("Convert free bet");
    expect(action.prefill?.betType).toBe("free_snr");
    expect(action.prefill?.backStake).toBe(50);
  });

  it("disables when qualifying bet is still open", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 3,
        title: "In play",
        rules,
        betCount: 1,
        profit: { qualifyingOpenCount: 1, freeBetStage: "awaiting_result" },
      })
    );
    expect(action.enabled).toBe(false);
    expect(action.label).toBe("Awaiting result");
    expect(action.prefill).toBeNull();
  });

  it("prefills raceExternalId for a race-scoped campaign", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 4,
        title: "Bet £10 get £10 free bet (2nd & 3rd)",
        rules,
        betCount: 0,
        scopeCourse: "Goodwood",
        scopeRaceId: "rac_32293062958",
        scopeRaceLabel: "1:50 · Highclere Castle Gin Summer Handicap Stakes",
        eventDate: "2026-08-01",
      })
    );
    expect(action.prefill?.raceExternalId).toBe("rac_32293062958");
    expect(action.prefill?.raceEventDate).toBe("2026-08-01");
    expect(action.prefill?.scopeCourse).toBe("Goodwood");
    expect(action.prefill?.labelSuggestion).toContain("Goodwood");
    expect(action.prefill?.labelSuggestion).toContain("1:50");
  });

  it("prefills scopeCourse for a course-scoped campaign (no race)", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 5,
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        rules,
        betCount: 0,
        scopeCourse: "Goodwood",
        eventDate: "2026-08-01",
      })
    );
    expect(action.prefill?.scopeCourse).toBe("Goodwood");
    expect(action.prefill?.raceEventDate).toBe("2026-08-01");
    expect(action.prefill?.raceExternalId).toBeUndefined();
  });

  it("prefills horse racing + Galway course for an unconditional course-scoped bet&get", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 126,
        title: "Bet £5 get £5 free bet",
        bookmaker: "Ladbrokes",
        rules: JSON.stringify({
          type: "bet_get_free_place",
          minRunners: 8,
          regions: ["GB", "IRE"],
          qualifyingPlaces: [],
          betStake: 5,
          freeBetAmount: 5,
        }),
        betCount: 0,
        scopeCourse: "Galway",
        eventDate: "2026-08-02",
      })
    );
    expect(action.prefill?.sport).toBe("horse_racing");
    expect(action.prefill?.market).toBe("win");
    expect(action.prefill?.scopeCourse).toBe("Galway");
    expect(action.prefill?.raceEventDate).toBe("2026-08-02");
    expect(action.prefill?.bookmaker).toBe("Ladbrokes");
  });

  it("does not prefill scopeCourse for regional UK & IRE scope", () => {
    const action = deriveTrackBetAction(
      offer({
        id: 6,
        title: "Bet £50 get £50 free bet",
        rules,
        betCount: 0,
        scopeCourse: "uk_ire",
        eventDate: "2026-08-01",
      })
    );
    expect(action.prefill?.scopeCourse).toBeUndefined();
  });
});
