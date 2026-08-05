import { describe, expect, it } from "vitest";
import {
  buildCasinoCalendarDays,
  casinoCalendarHasItems,
  isCasinoOfferInCalendar,
} from "./casino-offer-calendar";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

function offer(overrides: Partial<CasinoOfferSummary> = {}): CasinoOfferSummary {
  return {
    id: 1,
    casino: "Sky Vegas",
    title: "Test offer",
    bonusAmount: 0,
    wageringMultiplier: 0,
    rtp: null,
    contributionPct: null,
    status: "active",
    actualProfit: null,
    notes: null,
    game: null,
    expiresAt: null,
    createdAt: Date.now(),
    completedAt: null,
    components: [],
    expectedEv: 5,
    evBasis: "estimated",
    ...overrides,
  } as CasinoOfferSummary;
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe("isCasinoOfferInCalendar", () => {
  it("excludes completed and expired campaigns, includes planned/active", () => {
    expect(isCasinoOfferInCalendar(offer({ status: "planned" }))).toBe(true);
    expect(isCasinoOfferInCalendar(offer({ status: "active" }))).toBe(true);
    expect(isCasinoOfferInCalendar(offer({ status: "completed" }))).toBe(false);
    expect(isCasinoOfferInCalendar(offer({ status: "expired" }))).toBe(false);
  });
});

describe("buildCasinoCalendarDays", () => {
  it("places an offer on its expiry day and labels Today/Tomorrow correctly", () => {
    const now = new Date(2026, 6, 21, 10, 0, 0).getTime(); // 21 July 2026, 10:00 local
    const todayExpiry = new Date(2026, 6, 21, 18, 0, 0).getTime();
    const tomorrowExpiry = new Date(2026, 6, 22, 12, 0, 0).getTime();
    const laterExpiry = new Date(2026, 6, 28, 12, 0, 0).getTime();
    const offers = [
      offer({ id: 1, title: "Expires today", expiresAt: todayExpiry }),
      offer({ id: 2, title: "Expires tomorrow", expiresAt: tomorrowExpiry }),
      offer({ id: 3, title: "Expires later", expiresAt: laterExpiry }),
    ];
    const days = buildCasinoCalendarDays(offers, { now });
    expect(days.map((d) => d.label).slice(0, 2)).toEqual(["Today", "Tomorrow"]);
    expect(days).toHaveLength(3);
    expect(days[0].isToday).toBe(true);
    expect(days[1].isTomorrow).toBe(true);
    expect(days[0].items[0].offer.title).toBe("Expires today");
    expect(days[0].items[0].urgency).toBe("today");
    expect(days[1].items[0].urgency).toBe("tomorrow");
    expect(days[2].items[0].urgency).toBe("normal");
  });

  it("excludes offers with no expiry, completed, or expired status", () => {
    const now = Date.now();
    const offers = [
      offer({ id: 1, expiresAt: null }),
      offer({ id: 2, expiresAt: now + DAY_MS, status: "completed" }),
      offer({ id: 3, expiresAt: now + DAY_MS, status: "expired" }),
    ];
    expect(buildCasinoCalendarDays(offers, { now })).toEqual([]);
  });

  it("excludes offers expiring outside the horizon window", () => {
    const now = Date.now();
    const offers = [
      offer({ id: 1, expiresAt: now + 20 * DAY_MS }), // beyond default 14-day horizon
      offer({ id: 2, expiresAt: now - 2 * DAY_MS }), // already past
    ];
    expect(buildCasinoCalendarDays(offers, { now, horizonDays: 14 })).toEqual([]);
  });

  it("a wider horizon includes an offer previously excluded", () => {
    const now = Date.now();
    const offers = [offer({ id: 1, expiresAt: now + 20 * DAY_MS })];
    expect(buildCasinoCalendarDays(offers, { now, horizonDays: 14 })).toEqual([]);
    expect(buildCasinoCalendarDays(offers, { now, horizonDays: 30 }).length).toBe(1);
  });

  it("multiple offers on the same day are sorted by title and grouped into one day entry", () => {
    const now = Date.now();
    const sameDay = now + DAY_MS;
    const offers = [
      offer({ id: 1, title: "Zebra offer", expiresAt: sameDay }),
      offer({ id: 2, title: "Alpha offer", expiresAt: sameDay }),
    ];
    const days = buildCasinoCalendarDays(offers, { now });
    expect(days).toHaveLength(1);
    expect(days[0].items.map((i) => i.offer.title)).toEqual(["Alpha offer", "Zebra offer"]);
  });
});

describe("casinoCalendarHasItems", () => {
  it("true only when there's at least one in-window expiring campaign", () => {
    const now = Date.now();
    expect(casinoCalendarHasItems([offer({ expiresAt: null })], now)).toBe(false);
    expect(casinoCalendarHasItems([offer({ expiresAt: now + DAY_MS })], now)).toBe(true);
  });
});
