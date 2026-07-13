import { describe, expect, it } from "vitest";
import {
  deriveOfferNextAction,
  listOfferNextActions,
} from "@/lib/offers/next-actions";
import type { OfferSummary } from "@/lib/services/offers.types";

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
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: rest.expiresAt ?? null,
    completedAt: null,
    createdAt: Date.now(),
    seriesId: rest.seriesId ?? null,
    instanceDate: rest.instanceDate ?? null,
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
          openExpectedProfit: 0,
          totalProfit: -2,
        },
      }),
      now
    );
    expect(action?.kind).toBe("convert_free_bet");
    expect(action?.priority).toBeLessThan(20);
  });

  it("treats open conversion as waiting, not an actionable finish step", () => {
    const action = deriveOfferNextAction(
      offer({
        id: 4,
        title: "Bet £50 get £50 free bet (3rd, 4th)",
        betCount: 2,
        openBets: 1,
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
      now
    );
    expect(action?.kind).toBe("await_result");
    expect(action?.title).toMatch(/Conversion in play/i);
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

  it("ranks convert ahead of place qualifying and hides waiting conversions", () => {
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
            openExpectedProfit: 0,
            totalProfit: -1,
          },
        }),
        offer({
          id: 3,
          title: "Already converting",
          betCount: 2,
          profit: {
            qualifyingProfit: -3,
            qualifyingSettledCount: 1,
            qualifyingOpenCount: 0,
            freeBetAwarded: true,
            freeBetAwardAmount: 50,
            freeBetAwardReason: null,
            freeBetStage: "in_use",
            freeBetProfit: 0,
            freeBetOpenCount: 1,
            freeBetSettledCount: 0,
            openExpectedProfit: 39,
            totalProfit: 36,
          },
        }),
      ],
      now
    );
    expect(actions.map((a) => a.offerId)).toEqual([2, 1]);
    expect(actions[0]?.kind).toBe("convert_free_bet");
    expect(actions.every((a) => a.kind !== "await_result")).toBe(true);
  });

  it("shows only the next instance of a recurring series, not every repeat", () => {
    const actions = listOfferNextActions(
      [
        offer({ id: 10, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-08", status: "active" }),
        offer({ id: 11, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-09", status: "planned" }),
        offer({ id: 12, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-10", status: "planned" }),
        offer({ id: 20, title: "One-off", status: "active" }),
      ],
      now
    );
    expect(actions.filter((a) => a.offerTitle === "Daily reload").map((a) => a.offerId)).toEqual([10]);
    expect(actions.map((a) => a.offerId)).toContain(20);
  });

  it("surfaces the following instance once the current one is completed", () => {
    const actions = listOfferNextActions(
      [
        offer({ id: 10, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-08", status: "completed" }),
        offer({ id: 11, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-09", status: "planned" }),
        offer({ id: 12, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-10", status: "planned" }),
      ],
      now
    );
    expect(actions.map((a) => a.offerId)).toEqual([11]);
    expect(actions[0]?.kind).toBe("start_planned");
  });

  it("suppresses future repeats while the current instance is in play", () => {
    const actions = listOfferNextActions(
      [
        offer({
          id: 10,
          title: "Daily reload",
          seriesId: 1,
          instanceDate: "2026-07-08",
          status: "active",
          betCount: 1,
          profit: {
            qualifyingProfit: 0,
            qualifyingSettledCount: 0,
            qualifyingOpenCount: 1,
            freeBetAwarded: false,
            freeBetAwardAmount: null,
            freeBetAwardReason: null,
            freeBetStage: "awaiting_result",
            freeBetProfit: 0,
            freeBetOpenCount: 0,
            freeBetSettledCount: 0,
            openExpectedProfit: 0,
            totalProfit: 0,
          },
        }),
        offer({ id: 11, title: "Daily reload", seriesId: 1, instanceDate: "2026-07-09", status: "planned" }),
      ],
      now
    );
    expect(actions).toEqual([]);
  });
});
