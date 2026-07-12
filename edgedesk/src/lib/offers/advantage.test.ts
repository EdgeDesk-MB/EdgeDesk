import { describe, expect, it } from "vitest";
import {
  bestOfferAdvantage,
  estimateOfferRemainingEv,
  rankOfferAdvantages,
} from "@/lib/offers/advantage";
import type { OfferSummary } from "@/lib/services/offers.types";

function offer(partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    id: rest.id,
    bookmaker: rest.bookmaker ?? "Bet365",
    title: rest.title,
    description: null,
    expectedProfit: rest.expectedProfit ?? null,
    status: rest.status ?? "active",
    sport: rest.sport ?? null,
    offerType: rest.offerType ?? null,
    rules: rest.rules ?? null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: rest.expiresAt ?? null,
    completedAt: null,
    createdAt: Date.now(),
    betCount: rest.betCount ?? 0,
    openBets: rest.openBets ?? 0,
    actualProfit: 0,
    expectedFromBets: rest.expectedFromBets ?? 0,
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

const awardedFbOffer = offer({
  id: 1,
  title: "FB ready",
  profit: {
    qualifyingProfit: -2,
    qualifyingSettledCount: 1,
    qualifyingOpenCount: 0,
    freeBetAwarded: true,
    freeBetAwardAmount: 50,
    freeBetAwardReason: null,
    freeBetStage: "awarded",
    freeBetProfit: 0,
    freeBetOpenCount: 0,
    freeBetSettledCount: 0,
    openExpectedProfit: 0,
    totalProfit: -2,
  },
});

describe("estimateOfferRemainingEv", () => {
  it("values awarded free bets at default 0.8 retention", () => {
    const { remainingEv, basis } = estimateOfferRemainingEv(awardedFbOffer);
    expect(remainingEv).toBeCloseTo(40, 5);
    expect(basis).toBe("heuristic");
  });

  it("uses measured retention and upgrades basis when sampleSize >= 5", () => {
    const { remainingEv, basis } = estimateOfferRemainingEv(awardedFbOffer, {
      retention: 0.72,
      retentionSampleSize: 10,
    });
    expect(remainingEv).toBeCloseTo(36, 5);
    expect(basis).toBe("estimated");
  });

  it("stays heuristic when sampleSize < 5 even with custom retention", () => {
    const { basis } = estimateOfferRemainingEv(awardedFbOffer, {
      retention: 0.72,
      retentionSampleSize: 3,
    });
    expect(basis).toBe("heuristic");
  });

  it("returns estimated basis for explicit expectedProfit", () => {
    const { basis } = estimateOfferRemainingEv(
      offer({ id: 3, title: "Planned", expectedProfit: 10, betCount: 0, status: "planned" })
    );
    expect(basis).toBe("estimated");
  });

  it("returns estimated basis for open legs EV", () => {
    const { basis } = estimateOfferRemainingEv(
      offer({
        id: 4,
        title: "Open legs",
        expectedFromBets: 5,
        profit: {
          qualifyingProfit: -2,
          qualifyingSettledCount: 1,
          qualifyingOpenCount: 1,
          freeBetAwarded: false,
          freeBetAwardAmount: null,
          freeBetAwardReason: null,
          freeBetStage: "none",
          freeBetProfit: 0,
          freeBetOpenCount: 0,
          freeBetSettledCount: 0,
          openExpectedProfit: 5,
          totalProfit: -2,
        },
      })
    );
    expect(basis).toBe("estimated");
  });
});

describe("rankOfferAdvantages", () => {
  const now = new Date("2026-07-08T12:00:00Z").getTime();

  it("ranks awarded free bet above a low-EV planned offer", () => {
    const ranked = rankOfferAdvantages(
      [
        offer({ id: 1, title: "Small planned", expectedProfit: 5, betCount: 0, status: "planned" }),
        offer({
          id: 2,
          title: "Big FB",
          betCount: 1,
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
            openExpectedProfit: 0,
            totalProfit: -1,
          },
        }),
      ],
      now
    );
    expect(ranked[0]?.offerId).toBe(2);
    expect(bestOfferAdvantage(
      [
        offer({ id: 1, title: "Small planned", expectedProfit: 5, betCount: 0, status: "planned" }),
        offer({
          id: 2,
          title: "Big FB",
          betCount: 1,
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
            openExpectedProfit: 0,
            totalProfit: -1,
          },
        }),
      ],
      now
    )?.offerId).toBe(2);
  });

  it("does not promote in-progress conversion over a real qualify to-do", () => {
    const ranked = rankOfferAdvantages(
      [
        offer({
          id: 1,
          title: "Bet £10 get £10 free bet - Cricket",
          betCount: 0,
          status: "active",
        }),
        offer({
          id: 2,
          title: "Bet £50 get £50 free bet (3rd, 4th)",
          betCount: 2,
          expectedFromBets: 39.47,
          profit: {
            qualifyingProfit: -3.39,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 50,
            freeBetAwardReason: "Finished 2nd",
            freeBetStage: "in_use",
            freeBetProfit: 0,
            freeBetOpenCount: 1,
            freeBetSettledCount: 0,
            openExpectedProfit: 39.47,
            totalProfit: 36.08,
          },
        }),
      ],
      now
    );
    expect(ranked.map((r) => r.offerId)).toEqual([1]);
    expect(ranked[0]?.nextAction?.kind).toBe("place_qualifying");
  });
});
