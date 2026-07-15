import { describe, expect, it } from "vitest";
import {
  buildDoNextItems,
  keepFirstRecurringInstance,
  sortDoNextItems,
  sumActionableEv,
  type BookieBalanceMap,
} from "./do-next";
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
    bookmaker: partial.bookmaker ?? "Betfair Sportsbook",
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
    seriesId: null,
    instanceDate: null,
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

  it("E1 effort overrides change rateScore; untouched kinds keep built-ins", () => {
    const offers = [
      offer({ id: 1, title: "Planned offer", expectedProfit: 8, betCount: 0, status: "planned" }),
    ];

    const builtIn = buildDoNextItems(offers, [])[0]!;
    expect(builtIn.kind).toBe("start_planned");
    // start_planned built-in effort is 10 min → 8/10*60 = 48 £/hr
    expect(builtIn.rateScore).toBeCloseTo(48, 10);

    const tuned = buildDoNextItems(offers, [], undefined, {
      effortMinutes: { start_planned: 4 },
    })[0]!;
    // 8/4*60 = 120 £/hr
    expect(tuned.rateScore).toBeCloseTo(120, 10);

    const unrelated = buildDoNextItems(offers, [], undefined, {
      effortMinutes: { review_expiry: 1 },
    })[0]!;
    expect(unrelated.rateScore).toBeCloseTo(48, 10);
  });
});

describe("keepFirstRecurringInstance", () => {
  const recurring = [
    offer({ id: 10, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-13", status: "active" }),
    offer({ id: 11, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-14", status: "planned" }),
    offer({ id: 12, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-15", status: "planned" }),
    offer({ id: 20, title: "One-off", status: "active" }),
  ];

  it("keeps only the first instance of a repeating series", () => {
    const items = buildDoNextItems(recurring, []);
    expect(items.filter((i) => i.offerTitle === "Daily reload").length).toBeGreaterThan(1);

    const deduped = keepFirstRecurringInstance(items, recurring);
    expect(deduped.filter((i) => i.offerTitle === "Daily reload").map((i) => i.offerId)).toEqual([10]);
    expect(deduped.some((i) => i.offerId === 20)).toBe(true);
  });

  it("keeps the earliest instance regardless of item order", () => {
    const items = buildDoNextItems(recurring, []);
    const deduped = keepFirstRecurringInstance([...items].reverse(), recurring);
    expect(deduped.filter((i) => i.offerTitle === "Daily reload").map((i) => i.offerId)).toEqual([10]);
  });

  it("leaves items without an offer untouched", () => {
    const lots = [
      { id: 5, accountId: 1, accountName: "Sky Bet", remaining: 10, note: null, createdAt: 1 },
    ];
    const items = buildDoNextItems(recurring, lots);
    const deduped = keepFirstRecurringInstance(items, recurring);
    expect(deduped.some((i) => i.kind === "orphan_free_bet")).toBe(true);
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

describe("buildDoNextItems — bankroll-aware funding (B3)", () => {
  const qualifyOffer = offer({
    id: 100,
    title: "Qualify £10",
    bookmaker: "Bet365",
    betCount: 0,
    expectedProfit: 8,
    rules: JSON.stringify({ betStake: 10, type: "bet_get_free_place", minRunners: 8, regions: ["GB"], qualifyingPlaces: [], freeBetAmount: 10 }),
  });

  it("sets funding.short when account balance is insufficient", () => {
    const balances: BookieBalanceMap = new Map([["bet365", 4.5]]);
    const items = buildDoNextItems([qualifyOffer], [], Date.now(), undefined, balances);
    const item = items.find((i) => i.offerId === 100);
    expect(item?.funding?.short).toBeCloseTo(5.5); // 10 - 4.5
    expect(item?.funding?.needed).toBe(10);
    expect(item?.funding?.available).toBeCloseTo(4.5);
  });

  it("does not set funding when account is fully funded", () => {
    const balances: BookieBalanceMap = new Map([["bet365", 50]]);
    const items = buildDoNextItems([qualifyOffer], [], Date.now(), undefined, balances);
    const item = items.find((i) => i.offerId === 100);
    expect(item?.funding).toBeUndefined();
  });

  it("does not set funding when bookmaker is unmatched", () => {
    const balances: BookieBalanceMap = new Map([["paddy power", 0]]);
    const items = buildDoNextItems([qualifyOffer], [], Date.now(), undefined, balances);
    const item = items.find((i) => i.offerId === 100);
    expect(item?.funding).toBeUndefined();
  });

  it("adds a synthetic fund_account item for each shortfall account", () => {
    const balances: BookieBalanceMap = new Map([["bet365", 2]]);
    const items = buildDoNextItems([qualifyOffer], [], Date.now(), undefined, balances);
    const fundItem = items.find((i) => i.kind === "fund_account");
    expect(fundItem).toBeDefined();
    expect(fundItem?.bookmaker).toBe("Bet365");
    expect(fundItem?.href).toBe("/balances");
    expect(fundItem?.remainingEv).toBeGreaterThan(0);
  });

  it("sums EV across multiple blocked offers on the same account", () => {
    const offer2 = offer({
      id: 101,
      title: "Second at Bet365",
      bookmaker: "Bet365",
      betCount: 0,
      expectedProfit: 12,
      rules: JSON.stringify({ betStake: 10, type: "bet_get_free_place", minRunners: 8, regions: ["GB"], qualifyingPlaces: [], freeBetAmount: 15 }),
    });
    const balances: BookieBalanceMap = new Map([["bet365", 0]]);
    const items = buildDoNextItems([qualifyOffer, offer2], [], Date.now(), undefined, balances);
    const fundItems = items.filter((i) => i.kind === "fund_account");
    expect(fundItems).toHaveLength(1); // one per account
    expect(fundItems[0]?.remainingEv).toBeGreaterThan(0); // sum of both blocked EVs
  });
});
