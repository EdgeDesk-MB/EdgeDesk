import { describe, expect, it } from "vitest";
import { buildOfferCalendarDays } from "@/lib/offers/offer-calendar";
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
    sport: null,
    offerType: null,
    rules: null,
    scopeCourse: null,
    eventDate: null,
    expiresAt: rest.expiresAt ?? null,
    completedAt: null,
    createdAt: rest.createdAt ?? Date.now(),
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
      totalProfit: 0,
      ...profitPartial,
    },
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
    expect(today?.items.some((i) => i.kind === "planned")).toBe(true);
  });
});
