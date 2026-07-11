import { describe, expect, it } from "vitest";
import { buildDoNextItems, sortDoNextItems } from "./do-next";
import type { OfferSummary, OfferProfitBreakdown } from "@/lib/services/offers.types";

function emptyProfit(over: Partial<OfferProfitBreakdown> = {}): OfferProfitBreakdown {
  return {
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
    ...over,
  };
}

function offer(
  partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">
): OfferSummary {
  return {
    id: partial.id,
    bookmaker: partial.bookmaker ?? "Betfair Sportsbook",
    title: partial.title,
    description: null,
    expectedProfit: partial.expectedProfit ?? null,
    status: partial.status ?? "active",
    sport: null,
    offerType: null,
    rules: null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: partial.expiresAt ?? null,
    completedAt: null,
    createdAt: Date.now(),
    betCount: partial.betCount ?? 0,
    openBets: 0,
    actualProfit: 0,
    expectedFromBets: 0,
    profit: partial.profit ?? emptyProfit(),
    ...partial,
  };
}

describe("buildDoNextItems", () => {
  it("dedupes free-bet lots into matching convert actions", () => {
    const offers = [
      offer({
        id: 1,
        title: "Bet £50 get £50FB",
        bookmaker: "Betfair Sportsbook",
        profit: emptyProfit({
          freeBetStage: "awarded",
          freeBetAwarded: true,
          freeBetAwardAmount: 50,
          qualifyingSettledCount: 1,
        }),
      }),
      offer({
        id: 2,
        title: "Cricket £10",
        bookmaker: "Betfair Sportsbook",
        betCount: 0,
        profit: emptyProfit(),
      }),
    ];
    const lots = [
      {
        id: 10,
        accountId: 1,
        accountName: "Betfair Sportsbook",
        remaining: 50,
        note: "Manual free bet top-up",
        createdAt: 1,
      },
      {
        id: 11,
        accountId: 2,
        accountName: "Sky Bet",
        remaining: 20,
        note: "Orphan lot",
        createdAt: 2,
      },
    ];

    const items = buildDoNextItems(offers, lots);
    const convert = items.find((i) => i.offerId === 1);
    expect(convert?.kind).toBe("convert_free_bet");
    expect(convert?.convertLot?.remaining).toBe(50);

    const orphan = items.find((i) => i.kind === "orphan_free_bet");
    expect(orphan?.bookmaker).toBe("Sky Bet");
    expect(orphan?.convertLot?.remaining).toBe(20);

    expect(
      items.filter(
        (i) =>
          i.bookmaker === "Betfair Sportsbook" &&
          (i.kind === "convert_free_bet" || i.kind === "orphan_free_bet")
      )
    ).toHaveLength(1);
  });

  it("sorts by edge vs priority", () => {
    const items = buildDoNextItems(
      [
        offer({
          id: 1,
          title: "Small qualify",
          expectedProfit: 5,
          betCount: 0,
        }),
        offer({
          id: 2,
          title: "Big convert",
          profit: emptyProfit({
            freeBetStage: "awarded",
            freeBetAwarded: true,
            freeBetAwardAmount: 50,
            qualifyingSettledCount: 1,
          }),
        }),
      ],
      []
    );

    const byEdge = sortDoNextItems(items, "edge");
    expect(byEdge[0]?.offerId).toBe(2);

    const byPriority = sortDoNextItems(items, "priority");
    expect(byPriority[0]?.kind).toBe("convert_free_bet");
  });
});
