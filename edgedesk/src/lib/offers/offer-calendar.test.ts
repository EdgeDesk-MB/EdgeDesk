import { describe, expect, it } from "vitest";
import {
  buildOfferCalendarBoard,
  buildOfferCalendarDays,
  filterCalendarBoardByPriority,
} from "@/lib/offers/offer-calendar";
import type { OfferSummary } from "@/lib/services/offers.types";

function offer(
  partial: Omit<Partial<OfferSummary>, "profit"> &
    Pick<OfferSummary, "id" | "title"> & {
      profit?: Partial<OfferSummary["profit"]>;
    }
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
    expiresAt: rest.expiresAt ?? null,
    completedAt: null,
    createdAt: rest.createdAt ?? Date.now(),
    seriesId: rest.seriesId ?? null,
    instanceDate: rest.instanceDate ?? null,
    source: null,
    betCount: rest.betCount ?? 0,
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
    recurrence: rest.recurrence ?? null,
  };
}

describe("buildOfferCalendarDays", () => {
  const now = new Date(2026, 6, 8, 12, 0, 0).getTime(); // 8 Jul 2026 local

  it("groups expiries onto calendar days", () => {
    const expires = new Date(2026, 6, 10, 18, 0, 0).getTime();
    const days = buildOfferCalendarDays(
      [offer({ id: 1, title: "Reload", expiresAt: expires, status: "active" })],
      { now, horizonDays: 14 }
    );
    expect(days.some((d) => d.items.some((i) => i.kind === "expires"))).toBe(true);
  });

  it("puts planned offers on today when no expiry", () => {
    const days = buildOfferCalendarDays(
      [
        offer({
          id: 2,
          title: "Planned promo",
          status: "planned",
          betCount: 0,
          createdAt: now - 60_000,
        }),
      ],
      { now, horizonDays: 14 }
    );
    const today = days.find((d) => d.isToday);
    expect(today?.items.some((i) => i.offerId === 2)).toBe(true);
  });

  it("marks near-expiry items as critical priority", () => {
    const expires = new Date(2026, 6, 8, 20, 0, 0).getTime(); // later today
    const days = buildOfferCalendarDays(
      [offer({ id: 3, title: "Ends tonight", expiresAt: expires, status: "active" })],
      { now, horizonDays: 14 }
    );
    const item = days.flatMap((d) => d.items).find((i) => i.offerId === 3);
    expect(item?.priority).toBe("critical");
  });

  it("dedupes to one card per offer per day (action beats expires)", () => {
    const expires = new Date(2026, 6, 8, 20, 0, 0).getTime();
    const days = buildOfferCalendarDays(
      [
        offer({
          id: 4,
          title: "Bet £50 get £50",
          status: "active",
          betCount: 0,
          expiresAt: expires,
        }),
      ],
      { now, horizonDays: 14 }
    );
    const today = days.find((d) => d.isToday);
    expect(today?.items.filter((i) => i.offerId === 4)).toHaveLength(1);
    expect(today?.items[0]?.kind).toBe("action");
  });

  it("excludes completed and settled offers", () => {
    const expires = new Date(2026, 6, 10, 18, 0, 0).getTime();
    const days = buildOfferCalendarDays(
      [
        offer({
          id: 5,
          title: "Done",
          status: "completed",
          expiresAt: expires,
          profit: { freeBetStage: "settled" },
        }),
        offer({
          id: 6,
          title: "Settled active",
          status: "active",
          betCount: 2,
          expiresAt: expires,
          profit: { freeBetStage: "settled", qualifyingSettledCount: 1 },
        }),
      ],
      { now, horizonDays: 14 }
    );
    expect(days.flatMap((d) => d.items).some((i) => i.offerId === 5)).toBe(false);
    expect(days.flatMap((d) => d.items).some((i) => i.offerId === 6)).toBe(false);
  });

  it("places future recurring instances on their occurrence day", () => {
    const days = buildOfferCalendarDays(
      [
        offer({
          id: 7,
          title: "Daily QuinnBet",
          status: "planned",
          betCount: 0,
          instanceDate: "2026-07-09",
          source: null,
          expiresAt: new Date(2026, 6, 9, 23, 0, 0).getTime(),
          recurrence: {
            seriesId: 1,
            enabled: true,
            rule: { freq: "daily", interval: 1 },
            instanceDate: "2026-07-09",
            stoppedFrom: null,
          },
        }),
        offer({
          id: 8,
          title: "Daily QuinnBet",
          status: "planned",
          betCount: 0,
          instanceDate: "2026-07-12",
          source: null,
          expiresAt: new Date(2026, 6, 12, 23, 0, 0).getTime(),
          recurrence: {
            seriesId: 1,
            enabled: true,
            rule: { freq: "daily", interval: 1 },
            instanceDate: "2026-07-12",
            stoppedFrom: null,
          },
        }),
      ],
      { now, horizonDays: 14 }
    );
    const today = days.find((d) => d.isToday);
    const tomorrow = days.find((d) => d.isTomorrow);
    expect(today?.items.some((i) => i.offerId === 7) ?? false).toBe(false);
    expect(tomorrow?.items.some((i) => i.offerId === 7)).toBe(true);
    expect(days.find((d) => d.dateKey === "2026-07-12")?.items.some((i) => i.offerId === 8)).toBe(
      true
    );
  });

  it("excludes past recurring instances", () => {
    const days = buildOfferCalendarDays(
      [
        offer({
          id: 9,
          title: "Yesterday instance",
          status: "active",
          betCount: 0,
          instanceDate: "2026-07-07",
          source: null,
          expiresAt: new Date(2026, 6, 7, 23, 0, 0).getTime(),
          recurrence: {
            seriesId: 2,
            enabled: true,
            rule: { freq: "daily", interval: 1 },
            instanceDate: "2026-07-07",
            stoppedFrom: null,
          },
        }),
      ],
      { now, horizonDays: 14 }
    );
    expect(days.flatMap((d) => d.items).some((i) => i.offerId === 9)).toBe(false);
  });
});

describe("buildOfferCalendarBoard", () => {
  const now = new Date(2026, 6, 8, 12, 0, 0).getTime();

  it("puts today's actions in Today", () => {
    const columns = buildOfferCalendarBoard(
      [
        offer({
          id: 10,
          title: "Bet £50 get £50",
          status: "active",
          betCount: 0,
          expiresAt: new Date(2026, 6, 9, 12, 0, 0).getTime(),
        }),
      ],
      { now, horizonDays: 14 }
    );
    const today = columns.find((c) => c.id === "today");
    expect(today?.title).toBe("Today");
    expect(today?.items.some((i) => i.offerId === 10)).toBe(true);
  });

  it("keeps near-expiry (not today) out of Today", () => {
    const columns = buildOfferCalendarBoard(
      [
        offer({
          id: 12,
          title: "Ends in two days",
          status: "active",
          betCount: 1,
          expiresAt: new Date(2026, 6, 10, 12, 0, 0).getTime(), // ~2 days
          profit: { qualifyingOpenCount: 1 },
        }),
      ],
      { now, horizonDays: 14 }
    );
    const today = columns.find((c) => c.id === "today");
    const thisWeek = columns.find((c) => c.id === "this_week");
    // No place-qualifying action if already has bets - expiry lands this week
    expect(today?.items.some((i) => i.offerId === 12)).toBe(false);
    expect(
      thisWeek?.items.some((i) => i.offerId === 12) ||
        columns.find((c) => c.id === "later")?.items.some((i) => i.offerId === 12)
    ).toBe(true);
  });

  it("dedupes to one card per offer across columns", () => {
    const expires = new Date(2026, 6, 12, 12, 0, 0).getTime();
    const columns = buildOfferCalendarBoard(
      [
        offer({
          id: 11,
          title: "Multi signal",
          status: "active",
          betCount: 0,
          expiresAt: expires,
        }),
      ],
      { now, horizonDays: 14 }
    );
    const all = columns.flatMap((c) => c.items);
    expect(all.filter((i) => i.offerId === 11)).toHaveLength(1);
  });

  it("keeps future recurring instances out of Today column", () => {
    const columns = buildOfferCalendarBoard(
      [
        offer({
          id: 13,
          title: "Daily offer",
          status: "planned",
          betCount: 0,
          instanceDate: "2026-07-12",
          source: null,
          expiresAt: new Date(2026, 6, 12, 23, 0, 0).getTime(),
          recurrence: {
            seriesId: 3,
            enabled: true,
            rule: { freq: "daily", interval: 1 },
            instanceDate: "2026-07-12",
            stoppedFrom: null,
          },
        }),
      ],
      { now, horizonDays: 14 }
    );
    const today = columns.find((c) => c.id === "today");
    const thisWeek = columns.find((c) => c.id === "this_week");
    expect(today?.items.some((i) => i.offerId === 13)).toBe(false);
    expect(thisWeek?.items.some((i) => i.offerId === 13)).toBe(true);
  });
});

describe("filterCalendarBoardByPriority", () => {
  const now = new Date(2026, 6, 8, 12, 0, 0).getTime();

  it("filters board columns to selected priorities", () => {
    const columns = buildOfferCalendarBoard(
      [
        offer({
          id: 20,
          title: "Critical action",
          status: "active",
          betCount: 0,
          expiresAt: new Date(2026, 6, 8, 20, 0, 0).getTime(),
        }),
        offer({
          id: 21,
          title: "Later expiry",
          status: "active",
          betCount: 1,
          expiresAt: new Date(2026, 6, 20, 12, 0, 0).getTime(),
          profit: { qualifyingOpenCount: 1 },
        }),
      ],
      { now, horizonDays: 14 }
    );
    const filtered = filterCalendarBoardByPriority(columns, new Set(["critical"]));
    const items = filtered.flatMap((c) => c.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.priority === "critical")).toBe(true);
  });
});
