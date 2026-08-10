import { describe, expect, it } from "vitest";
import {
  formatOfferEventDay,
  formatOfferListGroupLabel,
  groupOffersByListDay,
  isOfferActiveInList,
  isOfferEffectivelyExpired,
  isOfferInExpiredFeed,
  isOfferInMainFeed,
  offerListFeedGroupDayMs,
  offerListGroupDayMs,
} from "./offer-list-groups";
import type { OfferProfitBreakdown, OfferSummary } from "@/lib/services/offers.types";

function offer(
  partial: Omit<Partial<OfferSummary>, "profit"> &
    Pick<OfferSummary, "id" | "title"> & { profit?: Partial<OfferProfitBreakdown> }
): OfferSummary {
  const { profit: profitPartial, ...rest } = partial;
  return {
    bookmaker: null,
    description: null,
    expectedProfit: null,
    status: rest.status ?? "active",
    sport: rest.sport ?? null,
    offerType: null,
    rules: null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    eventDate: rest.eventDate ?? null,
    expiresAt: rest.expiresAt ?? null,
    completedAt: null,
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: rest.offerUrl ?? null,
    createdAt: rest.createdAt ?? Date.now(),
    betCount: 0,
    openBets: 0,
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
    ...rest,
  };
}

describe("offer list date groups", () => {
  const now = new Date(2026, 6, 10, 18, 0, 0).getTime(); // 10 Jul 2026
  const today = new Date(2026, 6, 10).getTime();
  const tomorrow = new Date(2026, 6, 11).getTime();
  const yesterday = new Date(2026, 6, 9).getTime();

  it("labels today, tomorrow, and yesterday", () => {
    expect(formatOfferListGroupLabel(today, now)).toBe("Today");
    expect(formatOfferListGroupLabel(tomorrow, now)).toBe("Tomorrow");
    expect(formatOfferListGroupLabel(yesterday, now)).toBe("Yesterday");
    expect(formatOfferListGroupLabel(new Date(2026, 6, 6).getTime(), now)).toBe(
      "Monday 6th July"
    );
  });

  it("prefers instanceDate for recurring grouping", () => {
    const o = offer({
      id: 4,
      title: "Daily",
      instanceDate: "2026-07-11",
      source: null,
      eventDate: "2026-07-10",
    });
    expect(offerListGroupDayMs(o)).toBe(tomorrow);
  });

  it("excludes settled offers from the main feed", () => {
    const settled = offer({
      id: 5,
      title: "Converted",
      eventDate: "2026-07-10",
      status: "active",
      profit: { freeBetStage: "settled" },
    });
    expect(isOfferInMainFeed(settled, now)).toBe(false);
  });

  it("Active tab excludes not-started and planned campaigns", () => {
    const notStarted = offer({
      id: 8,
      title: "Ready",
      eventDate: "2026-07-10",
      status: "active",
      betCount: 0,
    });
    const planned = offer({
      id: 9,
      title: "Scheduled",
      eventDate: "2026-07-11",
      status: "planned",
      betCount: 0,
    });
    const inPlay = offer({
      id: 10,
      title: "Qualifying",
      eventDate: "2026-07-10",
      status: "active",
      betCount: 1,
      profit: { qualifyingOpenCount: 1 },
    });
    expect(isOfferActiveInList(notStarted, now)).toBe(false);
    expect(isOfferActiveInList(planned, now)).toBe(false);
    expect(isOfferActiveInList(inPlay, now)).toBe(true);
  });

  it("prefers eventDate for grouping", () => {
    const o = offer({
      id: 1,
      title: "Race day",
      eventDate: "2026-07-10",
      createdAt: new Date(2026, 6, 1).getTime(),
    });
    expect(offerListGroupDayMs(o)).toBe(today);
  });

  it("groups active feed ascending from today", () => {
    const groups = groupOffersByListDay(
      [
        offer({ id: 1, title: "A", eventDate: "2026-07-09", createdAt: 1 }),
        offer({ id: 2, title: "B", eventDate: "2026-07-10", createdAt: 2 }),
        offer({ id: 3, title: "C", eventDate: "2026-07-12", createdAt: 3 }),
      ],
      { now, sort: "ascending", minDayMs: today, useFeedDay: true }
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Sunday 12th July"]);
    expect(groups[0]?.offers.map((o) => o.id)).toEqual([2]);
  });

  it("groups expired feed descending from today", () => {
    const groups = groupOffersByListDay(
      [
        offer({ id: 1, title: "A", eventDate: "2026-07-08", status: "expired", createdAt: 1 }),
        offer({ id: 2, title: "B", eventDate: "2026-07-09", status: "expired", createdAt: 2 }),
        offer({ id: 3, title: "C", eventDate: "2026-07-10", status: "expired", createdAt: 3 }),
      ],
      { now, sort: "descending" }
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Wednesday 8th July"]);
  });

  it("puts evergreen offers under today in the feed", () => {
    const o = offer({
      id: 1,
      title: "Evergreen",
      createdAt: new Date(2026, 5, 1).getTime(),
    });
    expect(offerListFeedGroupDayMs(o, now)).toBe(today);
  });

  it("excludes expired and past offers from the main feed", () => {
    const past = offer({
      id: 1,
      title: "Missed",
      eventDate: "2026-07-09",
      status: "expired",
    });
    const completed = offer({
      id: 2,
      title: "Done",
      eventDate: "2026-07-09",
      status: "completed",
    });
    const future = offer({
      id: 3,
      title: "Upcoming",
      eventDate: "2026-07-11",
      status: "active",
    });
    expect(isOfferInMainFeed(past, now)).toBe(false);
    expect(isOfferInMainFeed(completed, now)).toBe(false);
    expect(isOfferInMainFeed(future, now)).toBe(true);
  });

  it("routes past-deadline active offers to expired feed", () => {
    const missed = offer({
      id: 1,
      title: "Late sync",
      eventDate: "2026-07-09",
      scopeRaceId: "r1",
      scopeRaceLabel: "15:00 · Handicap",
      status: "active",
    });
    expect(isOfferEffectivelyExpired(missed, now)).toBe(true);
    expect(isOfferInExpiredFeed(missed, now)).toBe(true);
    expect(isOfferInMainFeed(missed, now)).toBe(false);
  });

  it("formats event day for scope lines", () => {
    expect(formatOfferEventDay("2026-07-09")).toBe("9 Jul 2026");
  });
});
