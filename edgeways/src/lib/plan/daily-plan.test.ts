import { describe, expect, it } from "vitest";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { DoNextItem } from "@/lib/offers/do-next";
import {
  buildDailyPlan,
  mergePlanWithSeen,
  type DailyPlanFixtureInput,
  type DailyPlanRaceInput,
  type DailyPlanSlot,
} from "./daily-plan";

/** 2026-07-13 (Monday) 09:00 local. */
const NOW = new Date(2026, 6, 13, 9, 0, 0).getTime();
const AT = (h: number, m = 0) => new Date(2026, 6, 13, h, m, 0).getTime();

function offer(over: Partial<OfferSummary> & Pick<OfferSummary, "id">): OfferSummary {
  return {
    bookmaker: "Bet365",
    title: `Offer ${over.id}`,
    description: null,
    expectedProfit: 5,
    status: "active",
    expiresAt: null,
    sport: null,
    offerType: null,
    scopeCourse: null,
    eventDate: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    rules: null,
    seriesId: null,
    instanceDate: null,
    createdAt: NOW - 86_400_000,
    completedAt: null,
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
    },
    ...over,
  } as OfferSummary;
}

function doNextItem(over: Partial<DoNextItem> & Pick<DoNextItem, "id">): DoNextItem {
  return {
    kind: "place_qualifying",
    title: "Place qualifying bet",
    detail: "Bet £10 get £10",
    bookmaker: "Bet365",
    offerTitle: "Offer",
    offerId: null,
    href: "/offers",
    remainingEv: 4.2,
    basis: "estimated",
    priority: 10,
    edgeScore: 5,
    rateScore: 30,
    daysLeft: null,
    expiryLabel: null,
    ...over,
  };
}

const race = (over: Partial<DailyPlanRaceInput> = {}): DailyPlanRaceInput => ({
  eventId: 1,
  course: "Haydock",
  offTime: AT(13, 35),
  resultLogged: false,
  openExpected: 2.4,
  ...over,
});

const fixture = (over: Partial<DailyPlanFixtureInput> = {}): DailyPlanFixtureInput => ({
  eventId: 2,
  kickoff: AT(20, 0),
  label: "Arsenal v Chelsea",
  betCount: 1,
  openBetCount: 1,
  openExpected: 8,
  ...over,
});

describe("buildDailyPlan ordering", () => {
  it("orders timed slots ascending with the anytime bucket last", () => {
    const offers = [offer({ id: 5, expiresAt: AT(9, 30) })];
    const slots = buildDailyPlan({
      offers,
      doNext: [
        doNextItem({ id: "offer-5-place_qualifying", offerId: 5 }),
        doNextItem({ id: "offer-9-convert_free_bet", kind: "convert_free_bet", offerId: 9 }),
      ],
      races: [race()],
      fixtures: [fixture()],
      now: NOW,
    });

    expect(slots.map((s) => s.id)).toEqual([
      "offer-5-place_qualifying", // 09:30 expiry
      "race-1", // 13:35
      "kickoff-2", // 20:00
      "offer-9-convert_free_bet", // anytime (no expiry today)
    ]);
    expect(slots[0]?.kind).toBe("offer_action");
    expect(slots[0]?.at).toBe(AT(9, 30));
    expect(slots.at(-1)?.kind).toBe("anytime");
    expect(slots.at(-1)?.at).toBeNull();
  });

  it("excludes races and fixtures outside today's window", () => {
    const slots = buildDailyPlan({
      offers: [],
      doNext: [],
      races: [race({ offTime: AT(13) + 86_400_000 })],
      fixtures: [fixture({ kickoff: AT(20) - 2 * 86_400_000 })],
      now: NOW,
    });
    expect(slots).toHaveLength(0);
  });

  it("skips recurring instances materialised for future days", () => {
    const offers = [
      offer({ id: 7, seriesId: 1, instanceDate: "2026-07-13" }), // today
      offer({ id: 8, seriesId: 1, instanceDate: "2026-07-14" }), // tomorrow
    ];
    const slots = buildDailyPlan({
      offers,
      doNext: [
        doNextItem({ id: "offer-7-start_planned", kind: "start_planned", offerId: 7 }),
        doNextItem({ id: "offer-8-start_planned", kind: "start_planned", offerId: 8 }),
      ],
      races: [],
      fixtures: [],
      now: NOW,
    });
    expect(slots.map((s) => s.id)).toEqual(["offer-7-start_planned"]);
  });

  it("dedupes same-action same-title offers into one slot (course siblings, backfill dupes)", () => {
    const offers = [
      offer({ id: 20, title: "Bet £50 get £50 FB" }),
      offer({ id: 21, title: "Bet £50 get £50 FB" }),
      offer({ id: 22, title: "Bet £50 get £50 FB" }),
    ];
    const slots = buildDailyPlan({
      offers,
      doNext: [
        doNextItem({ id: "offer-20-place_qualifying", offerId: 20, offerTitle: "Bet £50 get £50 FB" }),
        doNextItem({ id: "offer-21-place_qualifying", offerId: 21, offerTitle: "Bet £50 get £50 FB" }),
        doNextItem({ id: "offer-22-place_qualifying", offerId: 22, offerTitle: "Bet £50 get £50 FB" }),
      ],
      races: [],
      fixtures: [],
      now: NOW,
    });
    // doNext arrives ranked - keep the best-ranked instance only
    expect(slots.map((s) => s.id)).toEqual(["offer-20-place_qualifying"]);
  });

  it("keeps different actions for the same offer title as separate slots", () => {
    const offers = [
      offer({ id: 23, title: "Bet £50 get £50 FB" }),
      offer({ id: 24, title: "Bet £50 get £50 FB" }),
    ];
    const slots = buildDailyPlan({
      offers,
      doNext: [
        doNextItem({ id: "offer-23-place_qualifying", offerId: 23, offerTitle: "Bet £50 get £50 FB" }),
        doNextItem({ id: "offer-24-convert_free_bet", kind: "convert_free_bet", offerId: 24, offerTitle: "Bet £50 get £50 FB" }),
      ],
      races: [],
      fixtures: [],
      now: NOW,
    });
    expect(slots).toHaveLength(2);
  });

  it("skips offers event-dated beyond today (today's sheet shows today only)", () => {
    const offers = [
      offer({ id: 25, eventDate: "2026-07-13" }), // today
      offer({ id: 26, eventDate: "2026-07-19" }), // Saturday
    ];
    const slots = buildDailyPlan({
      offers,
      doNext: [
        doNextItem({ id: "offer-25-place_qualifying", offerId: 25 }),
        doNextItem({ id: "offer-26-place_qualifying", offerId: 26, offerTitle: "Saturday offer" }),
      ],
      races: [],
      fixtures: [],
      now: NOW,
    });
    expect(slots.map((s) => s.id)).toEqual(["offer-25-place_qualifying"]);
  });

  it("skips await_result items", () => {
    const slots = buildDailyPlan({
      offers: [],
      doNext: [doNextItem({ id: "offer-3-await_result", kind: "await_result", offerId: 3 })],
      races: [],
      fixtures: [],
      now: NOW,
    });
    expect(slots).toHaveLength(0);
  });
});

describe("buildDailyPlan done rules", () => {
  it("marks races done once the off time has passed or a result is logged", () => {
    const slots = buildDailyPlan({
      offers: [],
      doNext: [],
      races: [
        race({ eventId: 1, offTime: AT(8, 30) }), // off-time passed (now 09:00)
        race({ eventId: 2, offTime: AT(13, 35) }),
        race({ eventId: 3, offTime: AT(15, 0), resultLogged: true }),
      ],
      fixtures: [],
      now: NOW,
    });
    expect(slots.map((s) => [s.id, s.done])).toEqual([
      ["race-1", true],
      ["race-2", false],
      ["race-3", true],
    ]);
  });

  it("marks fixtures done when all their bets have settled", () => {
    const slots = buildDailyPlan({
      offers: [],
      doNext: [],
      races: [],
      fixtures: [
        fixture({ eventId: 2, betCount: 2, openBetCount: 0 }),
        fixture({ eventId: 3, kickoff: AT(17), betCount: 1, openBetCount: 1 }),
      ],
      now: NOW,
    });
    expect(slots.find((s) => s.id === "kickoff-2")?.done).toBe(true);
    expect(slots.find((s) => s.id === "kickoff-3")?.done).toBe(false);
  });
});

describe("buildDailyPlan slot content", () => {
  it("carries EV and basis onto offer slots and expected £ onto race/kickoff slots", () => {
    const offers = [offer({ id: 5, expiresAt: AT(11) })];
    const slots = buildDailyPlan({
      offers,
      doNext: [doNextItem({ id: "offer-5-place_qualifying", offerId: 5, remainingEv: 4.2 })],
      races: [race({ openExpected: 2.4 })],
      fixtures: [fixture({ openExpected: 8 })],
      now: NOW,
    });
    expect(slots.find((s) => s.kind === "offer_action")?.ev).toBe(4.2);
    expect(slots.find((s) => s.kind === "offer_action")?.basis).toBe("estimated");
    expect(slots.find((s) => s.kind === "race")?.ev).toBe(2.4);
    expect(slots.find((s) => s.kind === "kickoff")?.ev).toBe(8);
  });

  it("deep-links race slots to the racing desk card", () => {
    const slots = buildDailyPlan({
      offers: [],
      doNext: [],
      races: [
        race({ eventId: 1, externalId: "rac_york_1610" }),
        race({ eventId: 2, course: "Newmarket", offTime: AT(14, 9) }),
      ],
      fixtures: [],
      now: NOW,
    });
    expect(slots.find((s) => s.id === "race-1")?.href).toBe("/racing?race=rac_york_1610");
    expect(slots.find((s) => s.id === "race-2")?.href).toBe("/racing");
  });

  it("keeps ids stable across rebuilds with identical inputs", () => {
    const input = {
      offers: [offer({ id: 5, expiresAt: AT(11) })],
      doNext: [doNextItem({ id: "offer-5-place_qualifying", offerId: 5 })],
      races: [race()],
      fixtures: [fixture()],
      now: NOW,
    };
    const a = buildDailyPlan(input).map((s) => s.id);
    const b = buildDailyPlan(input).map((s) => s.id);
    expect(a).toEqual(b);
  });
});

describe("mergePlanWithSeen", () => {
  const slot = (id: string, at: number | null, done = false): DailyPlanSlot => ({
    id,
    at,
    kind: at == null ? "anytime" : "offer_action",
    title: id,
    detail: null,
    priority: "medium",
    href: null,
    done,
  });

  it("keeps vanished slots visible as done, in time order (collapse, don't reorder)", () => {
    const prev = [slot("a", AT(9, 30)), slot("b", AT(13)), slot("c", null)];
    // "a" completed → no longer produced by the rebuild
    const next = [slot("b", AT(13)), slot("c", null)];
    const merged = mergePlanWithSeen(prev, next);
    expect(merged.map((s) => [s.id, s.done])).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
    ]);
  });

  it("inserts newly appearing slots at their time position", () => {
    const prev = [slot("a", AT(9, 30))];
    const next = [slot("a", AT(9, 30)), slot("new", AT(8))];
    const merged = mergePlanWithSeen(prev, next);
    expect(merged.map((s) => s.id)).toEqual(["new", "a"]);
  });

  it("prefers the fresh copy of surviving slots", () => {
    const prev = [slot("a", AT(9, 30))];
    const next = [{ ...slot("a", AT(9, 30)), title: "updated" }];
    const merged = mergePlanWithSeen(prev, next);
    expect(merged[0]?.title).toBe("updated");
  });
});
