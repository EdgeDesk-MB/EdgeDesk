import { describe, expect, it } from "vitest";
import {
  deriveOfferNextAction,
  listOfferNextActions,
} from "@/lib/offers/next-actions";
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
    sport: rest.sport ?? null,
    offerType: rest.offerType ?? null,
    rules: null,
    scopeCourse: null,
    eventDate: null,
    expiresAt: rest.expiresAt ?? null,
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

describe("deriveOfferNextAction", () => {
  const now = new Date("2026-07-08T12:00:00Z").getTime();

  it("asks to convert when free bet is awarded", () => {
    const action = deriveOfferNextAction(
      offer({
        id: 1,
        title: "Bet £50 get £50",
        profit: {
          qualifyingProfit: -2,
          qualifyingSettledCount: 1,
          qualifyingOpenCount: 0,
          freeBetAwarded: true,
          freeBetAwardAmount: 50,
          freeBetAwardReason: "Finished 2nd",
          freeBetStage: "awarded",
          freeBetProfit: 0,
          freeBetOpenCount: 0,
          freeBetSettledCount: 0,
          totalProfit: -2,
        },
      }),
      now
    );
    expect(action?.kind).toBe("convert_free_bet");
    expect(action?.priority).toBeLessThan(20);
  });

  it("asks to place qualifying when active with no bets", () => {
    const action = deriveOfferNextAction(
      offer({ id: 2, title: "Reload", betCount: 0, status: "active" }),
      now
    );
    expect(action?.kind).toBe("place_qualifying");
  });

  it("ignores completed offers", () => {
    expect(
      deriveOfferNextAction(offer({ id: 3, title: "Done", status: "completed" }), now)
    ).toBeNull();
  });

  it("ranks convert ahead of place qualifying", () => {
    const actions = listOfferNextActions(
      [
        offer({ id: 1, title: "Qualify me", betCount: 0, status: "active" }),
        offer({
          id: 2,
          title: "Convert me",
          betCount: 1,
          profit: {
            qualifyingProfit: -1,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 25,
            freeBetAwardReason: null,
            freeBetStage: "awarded",
            freeBetProfit: 0,
            freeBetOpenCount: 0,
            freeBetSettledCount: 0,
            totalProfit: -1,
          },
        }),
      ],
      now
    );
    expect(actions[0]?.offerId).toBe(2);
    expect(actions[0]?.kind).toBe("convert_free_bet");
  });
});
