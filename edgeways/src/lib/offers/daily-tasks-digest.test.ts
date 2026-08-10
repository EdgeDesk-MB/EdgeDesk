import { describe, expect, it } from "vitest";
import type { OfferProfitBreakdown, OfferSummary } from "@/lib/services/offers.types";
import type { DoNextItem } from "./do-next";
import {
  buildDailyTasksDigest,
  reminderHorizonDays,
  selectExpiryDoNextTasks,
} from "./daily-tasks-digest";

function emptyProfit(): OfferProfitBreakdown {
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
  };
}

function item(partial: Partial<DoNextItem> & Pick<DoNextItem, "id" | "title">): DoNextItem {
  return {
    kind: "place_qualifying",
    detail: "",
    bookmaker: "Betfair Sportsbook",
    offerTitle: partial.offerTitle ?? partial.title,
    offerId: partial.offerId ?? 1,
    href: "/offers",
    remainingEv: 8,
    basis: "heuristic",
    priority: 10,
    edgeScore: 8,
    rateScore: 60,
    daysLeft: 1,
    expiryLabel: "1 day left",
    ...partial,
  };
}

function offer(
  partial: Partial<OfferSummary> & Pick<OfferSummary, "id" | "title">
): OfferSummary {
  return {
    bookmaker: "Betfair Sportsbook",
    description: null,
    expectedProfit: null,
    status: "active",
    sport: "football",
    offerType: null,
    rules: null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: null,
    expiresAt: Date.now() + 86_400_000,
    completedAt: null,
    createdAt: Date.now(),
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: null,
    betCount: 0,
    openBets: 0,
    actualProfit: 0,
    expectedFromBets: 0,
    profit: emptyProfit(),
    ...partial,
  };
}

describe("reminderHorizonDays", () => {
  it("uses the largest configured day", () => {
    expect(reminderHorizonDays([3, 1])).toBe(3);
    expect(reminderHorizonDays([7, 3, 1])).toBe(7);
  });

  it("falls back to 3 when empty", () => {
    expect(reminderHorizonDays([])).toBe(3);
  });
});

describe("selectExpiryDoNextTasks", () => {
  it("pins convert free bets first, then soonest expiry", () => {
    const offers = [
      offer({ id: 1, title: "Near" }),
      offer({ id: 2, title: "Mid" }),
      offer({ id: 3, title: "Far" }),
    ];
    const tasks = selectExpiryDoNextTasks(
      [
        item({
          id: "a",
          offerId: 3,
          title: "Place qualifying bet",
          offerTitle: "Far",
          daysLeft: 5,
          expiryLabel: "5 days left",
          priority: 5,
        }),
        item({
          id: "b",
          offerId: 1,
          title: "Place qualifying bet",
          offerTitle: "Near",
          daysLeft: 0.2,
          expiryLabel: "Ends today",
          priority: 10,
        }),
        item({
          id: "c",
          offerId: 2,
          title: "Convert free bet",
          offerTitle: "Mid",
          kind: "convert_free_bet",
          freeBetAmount: 20,
          daysLeft: 2,
          expiryLabel: "2 days left",
          priority: 8,
        }),
      ],
      offers,
      3
    );

    expect(tasks.map((t) => t.offerId)).toEqual([2, 1]);
  });

  it("drops await_result, mug, and items without expiry", () => {
    const offers = [offer({ id: 1, title: "A" })];
    const tasks = selectExpiryDoNextTasks(
      [
        item({ id: "wait", title: "Await", kind: "await_result", daysLeft: 1 }),
        item({ id: "mug", title: "Mug", kind: "place_mug", daysLeft: 1 }),
        item({ id: "open", title: "No expiry", daysLeft: null, expiryLabel: null }),
      ],
      offers,
      3
    );
    expect(tasks).toHaveLength(0);
  });

  it("collapses repeating series to the current instance", () => {
    const offers = [
      offer({
        id: 10,
        title: "Weekly",
        seriesId: 1,
        instanceDate: "2026-08-04",
      }),
      offer({
        id: 11,
        title: "Weekly later",
        seriesId: 1,
        instanceDate: "2026-08-11",
      }),
    ];
    const tasks = selectExpiryDoNextTasks(
      [
        item({
          id: "later",
          offerId: 11,
          title: "Place qualifying bet",
          offerTitle: "Weekly later",
          daysLeft: 1,
        }),
        item({
          id: "current",
          offerId: 10,
          title: "Place qualifying bet",
          offerTitle: "Weekly",
          daysLeft: 2,
        }),
      ],
      offers,
      3
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.offerId).toBe(10);
  });
});

describe("buildDailyTasksDigest", () => {
  it("returns null when there is nothing to do", () => {
    expect(buildDailyTasksDigest([])).toBeNull();
  });

  it("builds a single briefing title and urgency-ordered body", () => {
    const content = buildDailyTasksDigest([
      item({
        id: "a",
        title: "Place qualifying bet",
        offerTitle: "Bet £10 get £10",
        daysLeft: 0.1,
        expiryLabel: "Ends today",
      }),
      item({
        id: "b",
        title: "Convert free bet",
        offerTitle: "Cricket promo",
        kind: "convert_free_bet",
        daysLeft: 2,
        expiryLabel: "2 days left",
      }),
    ]);
    expect(content?.title).toBe("Your tasks today · 2 due soon");
    expect(content?.body).toContain("Ends today: Place qualifying bet · Bet £10 get £10");
    expect(content?.body).toContain("2 days left: Convert free bet · Cricket promo");
  });
});
