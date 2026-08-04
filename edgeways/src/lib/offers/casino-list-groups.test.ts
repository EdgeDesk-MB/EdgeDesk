import { describe, expect, it } from "vitest";
import {
  casinoListFeedGroupDayMs,
  casinoListGroupDayMs,
  casinoNeedsAction,
  filterCasinoOffers,
  groupCasinoOffersByListDay,
  isCasinoEffectivelyExpired,
  isCasinoInMainFeed,
} from "@/lib/offers/casino-list-groups";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

function offer(
  partial: Partial<CasinoOfferSummary> & Pick<CasinoOfferSummary, "id" | "status">
): CasinoOfferSummary {
  return {
    casino: "PricedUp",
    title: "Test",
    bonusAmount: 0,
    wageringMultiplier: 0,
    rtp: null,
    contributionPct: null,
    expectedEv: 0,
    actualProfit: null,
    notes: null,
    game: null,
    expiresAt: null,
    seriesId: null,
    instanceDate: null,
    createdAt: 1,
    completedAt: null,
    components: [],
    evBasis: "defaulted",
    ...partial,
  } as CasinoOfferSummary;
}

const NOW = Date.UTC(2026, 7, 3, 12);

describe("casino list filters", () => {
  it("keeps planned and active in the main feed", () => {
    expect(isCasinoInMainFeed(offer({ id: 1, status: "planned" }), NOW)).toBe(true);
    expect(isCasinoInMainFeed(offer({ id: 2, status: "active" }), NOW)).toBe(true);
  });

  it("excludes completed and expired from the main feed", () => {
    expect(isCasinoInMainFeed(offer({ id: 1, status: "completed" }), NOW)).toBe(false);
    expect(isCasinoInMainFeed(offer({ id: 2, status: "expired" }), NOW)).toBe(false);
  });

  it("treats past expiresAt as expired while still open", () => {
    const missed = offer({ id: 1, status: "active", expiresAt: NOW - 1 });
    expect(isCasinoEffectivelyExpired(missed, NOW)).toBe(true);
    expect(isCasinoInMainFeed(missed, NOW)).toBe(false);
  });

  it("needs action matches open main-feed campaigns", () => {
    expect(casinoNeedsAction(offer({ id: 1, status: "planned" }), NOW)).toBe(true);
    expect(casinoNeedsAction(offer({ id: 2, status: "completed" }), NOW)).toBe(false);
  });

  it("filterCasinoOffers routes by tab", () => {
    const rows = [
      offer({ id: 1, status: "planned" }),
      offer({ id: 2, status: "active" }),
      offer({ id: 3, status: "completed", actualProfit: 11.31 }),
      offer({ id: 4, status: "expired" }),
      offer({ id: 5, status: "active", expiresAt: NOW - 1000 }),
    ];
    expect(filterCasinoOffers(rows, "all", NOW).map((o) => o.id)).toEqual([1, 2]);
    expect(filterCasinoOffers(rows, "needs_action", NOW).map((o) => o.id)).toEqual([1, 2]);
    expect(filterCasinoOffers(rows, "active", NOW).map((o) => o.id)).toEqual([2]);
    expect(filterCasinoOffers(rows, "completed", NOW).map((o) => o.id)).toEqual([3]);
    expect(filterCasinoOffers(rows, "expired", NOW).map((o) => o.id)).toEqual([4, 5]);
  });
});

describe("casino list date groups", () => {
  const now = new Date(2026, 7, 3, 12, 0, 0).getTime(); // 3 Aug 2026
  const today = new Date(2026, 7, 3).getTime();
  const tomorrow = new Date(2026, 7, 4).getTime();
  const yesterday = new Date(2026, 7, 2).getTime();

  it("prefers instanceDate for recurring grouping", () => {
    const o = offer({
      id: 1,
      status: "active",
      instanceDate: "2026-08-04",
      expiresAt: today + 3_600_000,
    });
    expect(casinoListGroupDayMs(o)).toBe(tomorrow);
  });

  it("falls back to expiresAt then completedAt then createdAt", () => {
    expect(
      casinoListGroupDayMs(
        offer({ id: 1, status: "active", expiresAt: tomorrow + 12 * 3_600_000 })
      )
    ).toBe(tomorrow);
    expect(
      casinoListGroupDayMs(
        offer({ id: 2, status: "completed", completedAt: yesterday + 3_600_000 })
      )
    ).toBe(yesterday);
    expect(
      casinoListGroupDayMs(offer({ id: 3, status: "planned", createdAt: today + 1 }))
    ).toBe(today);
  });

  it("puts evergreen offers under today in the feed", () => {
    const o = offer({
      id: 1,
      status: "planned",
      createdAt: new Date(2026, 5, 1).getTime(),
    });
    expect(casinoListFeedGroupDayMs(o, now)).toBe(today);
  });

  it("clamps past-dated open campaigns to today in the feed", () => {
    const o = offer({
      id: 1,
      status: "active",
      instanceDate: "2026-08-02",
      expiresAt: tomorrow + 3_600_000,
    });
    expect(casinoListGroupDayMs(o)).toBe(yesterday);
    expect(casinoListFeedGroupDayMs(o, now)).toBe(today);
  });

  it("groups active feed ascending from today", () => {
    const groups = groupCasinoOffersByListDay(
      [
        // Past expiry day clamps into Today when still in the feed.
        offer({ id: 1, status: "active", expiresAt: yesterday + 3_600_000, createdAt: 1 }),
        offer({ id: 2, status: "active", expiresAt: today + 3_600_000, createdAt: 2 }),
        offer({ id: 3, status: "planned", expiresAt: tomorrow + 3_600_000, createdAt: 3 }),
        offer({ id: 4, status: "planned", createdAt: 4 }),
      ],
      { now, sort: "ascending", minDayMs: today, useFeedDay: true }
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Tomorrow"]);
    expect(groups[0]?.offers.map((o) => o.id)).toEqual([4, 2, 1]);
    expect(groups[1]?.offers.map((o) => o.id)).toEqual([3]);
  });

  it("groups completed feed descending", () => {
    const groups = groupCasinoOffersByListDay(
      [
        offer({
          id: 1,
          status: "completed",
          completedAt: yesterday + 3_600_000,
          createdAt: 1,
        }),
        offer({
          id: 2,
          status: "completed",
          completedAt: today + 3_600_000,
          createdAt: 2,
        }),
      ],
      { now, sort: "descending" }
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday"]);
  });
});
