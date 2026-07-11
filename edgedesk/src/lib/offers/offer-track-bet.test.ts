import { describe, expect, it } from "vitest";
import { deriveTrackBetAction } from "./offer-track-bet";
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
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: null,
    completedAt: null,
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
});
