import { describe, expect, it } from "vitest";
import {
  deriveOfferPipelineStage,
  OFFER_PIPELINE_PROGRESS_STAGES,
  offerPipelineHasStarted,
  pipelineProgressIndex,
} from "@/lib/offers/pipeline";
import type { OfferProfitBreakdown, OfferSummary } from "@/lib/services/offers.types";

function offer(
  partial: Omit<Partial<OfferSummary>, "profit"> &
    Pick<OfferSummary, "id" | "title"> & { profit?: Partial<OfferProfitBreakdown> }
): OfferSummary {
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
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
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
      openExpectedProfit: 0,
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
            openExpectedProfit: 0,
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

  it("maps completed offers to completed until bets settle", () => {
    expect(
      deriveOfferPipelineStage(offer({ id: 3, title: "Done", status: "completed" }))
    ).toBe("completed");
  });

  it("maps financially settled offers to settled", () => {
    expect(
      deriveOfferPipelineStage(
        offer({
          id: 6,
          title: "Settled FB",
          status: "completed",
          profit: {
            qualifyingSettledCount: 1,
            freeBetSettledCount: 1,
            freeBetStage: "settled",
          },
        })
      )
    ).toBe("settled");
  });
});

describe("offer pipeline progress", () => {
  it("excludes planned from visible progress steps", () => {
    expect(OFFER_PIPELINE_PROGRESS_STAGES).toHaveLength(6);
    expect(OFFER_PIPELINE_PROGRESS_STAGES.map((s) => s.id)).toEqual([
      "qualifying",
      "awaiting",
      "awarded",
      "converting",
      "completed",
      "settled",
    ]);
  });

  it("qualifying is step 1 of 6 once started", () => {
    expect(pipelineProgressIndex("qualifying")).toBe(0);
  });

  it("completed is step 5 of 6", () => {
    expect(pipelineProgressIndex("completed")).toBe(4);
  });

  it("settled is step 6 of 6", () => {
    expect(pipelineProgressIndex("settled")).toBe(5);
  });

  it("treats unstarted offers as not started", () => {
    expect(
      offerPipelineHasStarted(offer({ id: 4, title: "New", status: "planned", betCount: 0 }))
    ).toBe(false);
  });

  it("treats qualifying offers as started", () => {
    expect(
      offerPipelineHasStarted(
        offer({
          id: 5,
          title: "Started",
          betCount: 1,
          profit: { qualifyingOpenCount: 1 },
        })
      )
    ).toBe(true);
  });
});
