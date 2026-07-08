import { describe, expect, it } from "vitest";
import { deriveOfferPipelineStage } from "@/lib/offers/pipeline";
import type { OfferSummary } from "@/lib/services/offers";

function offer(partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    id: rest.id,
    bookmaker: rest.bookmaker ?? "Bet365",
    title: rest.title,
    description: null,
    expectedProfit: null,
    status: rest.status ?? "active",
    sport: null,
    offerType: null,
    rules: null,
    scopeCourse: null,
    eventDate: null,
    expiresAt: null,
    completedAt: null,
    createdAt: Date.now(),
    betCount: rest.betCount ?? 0,
    openBets: rest.openBets ?? 0,
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
      totalProfit: 0,
      ...profitPartial,
    },
  };
}

describe("deriveOfferPipelineStage", () => {
  it("maps awarded free bet stage", () => {
    expect(
      deriveOfferPipelineStage(
        offer({
          id: 1,
          title: "FB",
          profit: {
            qualifyingProfit: -1,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 50,
            freeBetAwardReason: null,
            freeBetStage: "awarded",
            freeBetProfit: 0,
            freeBetOpenCount: 0,
            freeBetSettledCount: 0,
            totalProfit: -1,
          },
        })
      )
    ).toBe("awarded");
  });

  it("maps planned with no bets", () => {
    expect(
      deriveOfferPipelineStage(offer({ id: 2, title: "New", status: "planned", betCount: 0 }))
    ).toBe("planned");
  });

  it("maps completed offers to settled", () => {
    expect(
      deriveOfferPipelineStage(offer({ id: 3, title: "Done", status: "completed" }))
    ).toBe("settled");
  });
});
