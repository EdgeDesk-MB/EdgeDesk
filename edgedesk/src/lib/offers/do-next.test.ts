import { describe, expect, it } from "vitest";
import { buildDoNextItems, sortDoNextItems, sumActionableEv } from "./do-next";
import type { DoNextItem } from "./do-next";
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

  it("rate sort: a £2/1.5-min item outranks a £5/20-min item", () => {
    // £2 at 1.5 min → rateScore = 2/1.5*60 = 80 £/hr
    // £5 at 8 min (place_qualifying) → rateScore = 5/8*60 = 37.5 £/hr
    // Both are place_qualifying actions (8 min). To create a meaningful difference,
    // we build items manually for the rate sort test.
    const items: DoNextItem[] = [
      {
        id: "a",
        kind: "place_qualifying",
        title: "Big but slow",
        detail: "",
        bookmaker: "Bet365",
        offerTitle: null,
        offerId: 1,
        href: null,
        remainingEv: 5,
        basis: "estimated",
        priority: 5,
        edgeScore: 5,
        rateScore: 37.5, // 5/8*60
        daysLeft: null,
        expiryLabel: null,
      },
      {
        id: "b",
        kind: "review_expiry", // 2 min effort
        title: "Quick high-rate",
        detail: "",
        bookmaker: "Sky Bet",
        offerTitle: null,
        offerId: 2,
        href: null,
        remainingEv: 2,
        basis: "estimated",
        priority: 5,
        edgeScore: 2,
        rateScore: 60, // 2/2*60
        daysLeft: null,
        expiryLabel: null,
      },
    ];
    const byRate = sortDoNextItems(items, "rate");
    expect(byRate[0]?.id).toBe("b"); // higher rateScore wins
  });
});

describe("sumActionableEv", () => {
  it("excludes await_result items", () => {
    const items: DoNextItem[] = [
      {
        id: "1",
        kind: "await_result",
        title: "",
        detail: "",
        bookmaker: null,
        offerTitle: null,
        offerId: 1,
        href: null,
        remainingEv: 10,
        basis: "estimated",
        priority: 1,
        edgeScore: 10,
        rateScore: 0,
        daysLeft: null,
        expiryLabel: null,
      },
      {
        id: "2",
        kind: "convert_free_bet",
        title: "",
        detail: "",
        bookmaker: null,
        offerTitle: null,
        offerId: 2,
        href: null,
        remainingEv: 8,
        basis: "estimated",
        priority: 2,
        edgeScore: 8,
        rateScore: 80,
        daysLeft: null,
        expiryLabel: null,
      },
    ];
    const { total } = sumActionableEv(items);
    expect(total).toBeCloseTo(8); // await_result excluded
  });

  it("returns weakest basis across contributors", () => {
    const items: DoNextItem[] = [
      {
        id: "1",
        kind: "place_qualifying",
        title: "",
        detail: "",
        bookmaker: null,
        offerTitle: null,
        offerId: 1,
        href: null,
        remainingEv: 5,
        basis: "estimated",
        priority: 1,
        edgeScore: 5,
        rateScore: 37.5,
        daysLeft: null,
        expiryLabel: null,
      },
      {
        id: "2",
        kind: "convert_free_bet",
        title: "",
        detail: "",
        bookmaker: null,
        offerTitle: null,
        offerId: 2,
        href: null,
        remainingEv: 3,
        basis: "heuristic",
        priority: 2,
        edgeScore: 3,
        rateScore: 30,
        daysLeft: null,
        expiryLabel: null,
      },
    ];
    const { total, weakestBasis } = sumActionableEv(items);
    expect(total).toBeCloseTo(8);
    expect(weakestBasis).toBe("heuristic"); // heuristic < estimated
  });

  it("returns heuristic basis when list is empty", () => {
    const { total, weakestBasis } = sumActionableEv([]);
    expect(total).toBe(0);
    expect(weakestBasis).toBe("heuristic");
  });
});
