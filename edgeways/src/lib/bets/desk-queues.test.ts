import { describe, expect, it } from "vitest";
import {
  betNeedsLay,
  countDeskQueue,
  filterBetsByDeskQueue,
  groupBetsByCampaign,
} from "@/lib/bets/desk-queues";
import type { BetRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id">): BetRow {
  return {
    id: partial.id,
    eventId: partial.eventId ?? null,
    label: partial.label ?? `Bet ${partial.id}`,
    market: partial.market ?? "match_odds",
    selection: partial.selection ?? "",
    betType: partial.betType ?? "qualifying",
    bookmaker: partial.bookmaker ?? "Bet365",
    exchangeId: partial.exchangeId ?? null,
    backStake: partial.backStake ?? 10,
    backOdds: partial.backOdds ?? 2,
    layStake: partial.layStake ?? 0,
    layOdds: partial.layOdds ?? 0,
    commission: partial.commission ?? 0.02,
    earlyPayout: partial.earlyPayout ?? 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: partial.status ?? "open",
    expectedProfit: null,
    actualProfit: null,
    notes: partial.notes ?? null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: partial.createdAt ?? Date.now(),
    settledAt: null,
    offerId: partial.offerId ?? null,
    quickLogged: partial.quickLogged ?? null,
    source: partial.source ?? null,
    purpose: partial.purpose ?? null,
    sport: partial.sport ?? null,
  };
}

describe("betNeedsLay", () => {
  it("flags open backs without a lay", () => {
    expect(betNeedsLay(bet({ id: 1, backStake: 20, layStake: 0 }))).toBe(true);
  });

  it("ignores hedged and settled bets", () => {
    expect(betNeedsLay(bet({ id: 2, backStake: 20, layStake: 18 }))).toBe(false);
    expect(betNeedsLay(bet({ id: 3, status: "won", backStake: 20, layStake: 0 }))).toBe(false);
  });

  it("ignores Acca Desk backs (hedged via separate lay_only bets)", () => {
    expect(
      betNeedsLay(
        bet({
          id: 4,
          backStake: 20,
          layStake: 0,
          label: "Acca · Offer",
          notes: "Acca desk run - hedged leg-by-leg on the exchange",
        })
      )
    ).toBe(false);
  });

  it("ignores Bet Builder Desk backs (combined lay or deliberate no lay)", () => {
    expect(
      betNeedsLay(
        bet({
          id: 5,
          backStake: 10,
          layStake: 0,
          label: "BB · Arsenal builder",
          notes: "Bet Builder desk - no lay",
        })
      )
    ).toBe(false);
  });
});

describe("filterBetsByDeskQueue", () => {
  const bets = [
    bet({ id: 1, offerId: 10, layStake: 0 }),
    bet({ id: 2, offerId: 10, layStake: 9 }),
    bet({ id: 3, offerId: null, status: "won", layStake: 0 }),
    bet({ id: 4, offerId: null, layStake: 0 }),
  ];

  it("counts open, needs_lay, and settle inbox", () => {
    expect(countDeskQueue(bets, "open")).toBe(3);
    expect(countDeskQueue(bets, "needs_lay")).toBe(2);
    expect(filterBetsByDeskQueue(bets, "orphans").map((b) => b.id)).toEqual([3, 4]);

    const withEvent = [
      bet({ id: 10, eventId: 1, status: "open" }),
      bet({ id: 11, eventId: 2, status: "open" }),
      bet({ id: 12, eventId: 1, status: "won" }),
    ];
    const events = new Map([
      [1, { status: "finished" as const }],
      [2, { status: "live" as const }],
    ]);
    expect(countDeskQueue(withEvent, "settle", events)).toBe(1);
    expect(filterBetsByDeskQueue(withEvent, "settle", events).map((b) => b.id)).toEqual([10]);
  });

  it("quick_logged queue matches only mobile-captured bets", () => {
    const mixed = [
      bet({ id: 20, quickLogged: 1_783_900_000_000 }),
      bet({ id: 21, quickLogged: null }),
    ];
    expect(filterBetsByDeskQueue(mixed, "quick_logged").map((b) => b.id)).toEqual([20]);
    expect(countDeskQueue(mixed, "quick_logged")).toBe(1);
  });
});

describe("groupBetsByCampaign", () => {
  it("groups by offer and appends orphans", () => {
    const offerById = new Map<number, OfferSummary>([
      [
        10,
        {
          id: 10,
          bookmaker: "Bet365",
          title: "Bet £50 get £50",
          description: null,
          expectedProfit: null,
          status: "active",
          sport: null,
          offerType: null,
          rules: null,
          scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
          eventDate: null,
          expiresAt: null,
          completedAt: null,
          createdAt: Date.now(),
          seriesId: null,
          instanceDate: null,
          startsOn: null,
          source: null,
          offerUrl: null,
          betCount: 2,
          openBets: 2,
          actualProfit: 0,
          expectedFromBets: 0,
          profit: {
            qualifyingProfit: 0,
            qualifyingSettledCount: 0,
            qualifyingOpenCount: 1,
            freeBetAwarded: false,
            freeBetAwardAmount: null,
            freeBetAwardReason: null,
            freeBetStage: "none",
            freeBetProfit: 0,
            freeBetOpenCount: 0,
            freeBetSettledCount: 0,
            openExpectedProfit: 0,
            totalProfit: 0,
          },
        },
      ],
    ]);

    const groups = groupBetsByCampaign(
      [
        bet({ id: 1, offerId: 10, createdAt: 200 }),
        bet({ id: 2, offerId: 10, createdAt: 100 }),
        bet({ id: 3, offerId: null, createdAt: 50 }),
      ],
      offerById
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.offerId).toBe(10);
    expect(groups[0]?.title).toBe("Bet £50 get £50");
    // Oldest first within a campaign (narrative order).
    expect(groups[0]?.bets.map((b) => b.id)).toEqual([2, 1]);
    expect(groups[1]?.offerId).toBeNull();
    expect(groups[1]?.title).toBe("Unlinked bets");
  });
});
