import { describe, expect, it } from "vitest";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import { groupBetsByCampaign } from "@/lib/bets/desk-queues";
import {
  betTrackerListDayMs,
  explodeOrphanCampaignsByDay,
  groupBetsByListDay,
  groupCampaignsByListDay,
} from "@/lib/bets/tracker-list-groups";
import { startOfLocalDay } from "@/lib/offers/offer-list-groups";

const now = new Date(2026, 8, 6, 12).getTime(); // Sunday 6 Sep 2026
const today = startOfLocalDay(now);
const yesterday = startOfLocalDay(new Date(2026, 8, 5, 15).getTime());
const tomorrow = startOfLocalDay(new Date(2026, 8, 7, 15).getTime());

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
    createdAt: partial.createdAt ?? now,
    settledAt: null,
    offerId: partial.offerId ?? null,
    quickLogged: partial.quickLogged ?? null,
    source: partial.source ?? null,
    purpose: partial.purpose ?? null,
    sport: partial.sport ?? null,
    importFingerprint: partial.importFingerprint ?? null,
    importMeta: partial.importMeta ?? null,
  };
}

function offer(partial: Pick<OfferSummary, "id" | "title"> & Partial<OfferSummary>): OfferSummary {
  return {
    bookmaker: "Bet365",
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
    seriesId: null,
    instanceDate: null,
    startsOn: null,
    source: null,
    offerUrl: null,
    createdAt: now,
    betCount: 1,
    openBets: 1,
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
    ...partial,
  };
}

function event(id: number, startTime: number): Pick<EventRow, "id" | "startTime"> {
  return { id, startTime };
}

describe("betTrackerListDayMs", () => {
  it("uses the linked event's kick-off day", () => {
    const eventById = new Map([[1, event(1, yesterday + 18 * 60 * 60 * 1000)]]);
    expect(betTrackerListDayMs(bet({ id: 1, eventId: 1, createdAt: now }), eventById)).toBe(
      yesterday
    );
  });

  it("falls back to the offer list day, then createdAt", () => {
    const empty = new Map<number, Pick<EventRow, "startTime">>();
    const promo = offer({ id: 9, title: "Promo", eventDate: "2026-09-07" });
    expect(betTrackerListDayMs(bet({ id: 2, offerId: 9 }), empty, promo)).toBe(tomorrow);
    expect(betTrackerListDayMs(bet({ id: 3, createdAt: yesterday + 1000 }), empty)).toBe(yesterday);
  });
});

describe("groupCampaignsByListDay", () => {
  it("bands campaigns Today then Yesterday, matching Tracked Events labels", () => {
    const todayOffer = offer({ id: 1, title: "Today promo", eventDate: "2026-09-06" });
    const yesterdayOffer = offer({
      id: 2,
      title: "Yesterday promo",
      eventDate: "2026-09-05",
      status: "completed",
    });
    const offerById = new Map([
      [1, todayOffer],
      [2, yesterdayOffer],
    ]);
    const groups = groupBetsByCampaign(
      [bet({ id: 10, offerId: 1 }), bet({ id: 20, offerId: 2, createdAt: yesterday })],
      offerById,
      { includeOrphans: false }
    );
    const sections = groupCampaignsByListDay(groups, new Map(), now);
    expect(sections.map((s) => s.label)).toEqual(["Today", "Yesterday"]);
    expect(sections.map((s) => s.upcoming)).toEqual([false, false]);
    expect(sections[0]?.groups.map((g) => g.offerId)).toEqual([1]);
    expect(sections[1]?.groups.map((g) => g.offerId)).toEqual([2]);
  });

  it("orders newest calendar day first: future, Today, Yesterday", () => {
    const later = offer({ id: 3, title: "Tomorrow", eventDate: "2026-09-07" });
    const todayOffer = offer({ id: 5, title: "Today", eventDate: "2026-09-06" });
    const earlier = offer({ id: 4, title: "Yesterday", eventDate: "2026-09-05" });
    const groups = groupBetsByCampaign(
      [
        bet({ id: 1, offerId: 3, createdAt: tomorrow }),
        bet({ id: 5, offerId: 5, createdAt: now }),
        bet({ id: 2, offerId: 4, createdAt: yesterday }),
      ],
      new Map([
        [3, later],
        [5, todayOffer],
        [4, earlier],
      ]),
      { includeOrphans: false }
    );
    const sections = groupCampaignsByListDay(groups, new Map(), now);
    expect(sections.map((s) => s.label)).toEqual(["Tomorrow", "Today", "Yesterday"]);
    expect(sections.map((s) => s.upcoming)).toEqual([true, false, false]);
  });

  it("buckets a campaign on bet activity, not a future offer date", () => {
    const tennis = offer({ id: 8, title: "Tennis FB", eventDate: "2026-09-13" });
    const groups = groupBetsByCampaign(
      [bet({ id: 1, offerId: 8, eventId: 1, createdAt: yesterday })],
      new Map([[8, tennis]]),
      { includeOrphans: false }
    );
    const eventById = new Map([[1, event(1, yesterday + 12 * 60 * 60 * 1000)]]);
    const sections = groupCampaignsByListDay(groups, eventById, now);
    expect(sections.map((s) => s.label)).toEqual(["Yesterday"]);
    expect(sections[0]?.upcoming).toBe(false);
  });

  it("splits unlinked bets across days", () => {
    const eventById = new Map([
      [1, event(1, today + 12 * 60 * 60 * 1000)],
      [2, event(2, yesterday + 12 * 60 * 60 * 1000)],
    ]);
    const groups = groupBetsByCampaign(
      [bet({ id: 1, eventId: 1 }), bet({ id: 2, eventId: 2 })],
      new Map()
    );
    expect(groups).toHaveLength(1);
    const exploded = explodeOrphanCampaignsByDay(groups, eventById);
    expect(exploded).toHaveLength(2);
    const sections = groupCampaignsByListDay(groups, eventById, now);
    expect(sections.map((s) => s.label)).toEqual(["Today", "Yesterday"]);
    expect(sections[0]?.groups[0]?.bets.map((b) => b.id)).toEqual([1]);
    expect(sections[1]?.groups[0]?.bets.map((b) => b.id)).toEqual([2]);
  });
});

describe("groupBetsByListDay", () => {
  it("groups a flat queue by event day", () => {
    const eventById = new Map([
      [1, event(1, today + 1000)],
      [2, event(2, yesterday + 1000)],
    ]);
    const sections = groupBetsByListDay(
      [bet({ id: 1, eventId: 1 }), bet({ id: 2, eventId: 2 })],
      eventById,
      new Map(),
      now
    );
    expect(sections.map((s) => ({ label: s.label, ids: s.bets.map((b) => b.id) }))).toEqual([
      { label: "Today", ids: [1] },
      { label: "Yesterday", ids: [2] },
    ]);
  });
});
