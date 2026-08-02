import { describe, expect, it } from "vitest";
import type { DoNextItem } from "@/lib/offers/do-next";
import {
  evaluateAlertRules,
  offerExpiringAlertDedupePrefix,
  offerExpiringAlertKeys,
  type AlertRuleInput,
} from "./rules";
import type { OfferImpactOffer } from "./offer-impact";

/** 2026-07-13 09:00 local */
const NOW = new Date(2026, 6, 13, 9, 0, 0).getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;

function doNextItem(over: Partial<DoNextItem> & Pick<DoNextItem, "id">): DoNextItem {
  return {
    kind: "place_qualifying",
    title: "Place qualifying bet",
    detail: "",
    bookmaker: "Bet365",
    offerTitle: "Bet £10 get £10",
    offerId: 5,
    href: "/offers",
    remainingEv: 12,
    basis: "estimated",
    priority: 10,
    edgeScore: 5,
    rateScore: 30,
    daysLeft: 0.5,
    expiryLabel: "Ends today",
    ...over,
  };
}

function offer(over: Partial<OfferImpactOffer> = {}): OfferImpactOffer {
  return {
    id: 5,
    title: "Bet £10 get £10",
    sport: "football",
    eventDate: null,
    scopeCourse: null,
    scopeRaceId: null,
    scopeRaceLabel: null,
    expiresAt: NOW + 90 * MIN,
    ...over,
  };
}

const base: AlertRuleInput = {
  now: NOW,
  prefs: {
    offerExpiring: true,
    raceOffSoon: true,
    resultSettled: true,
    nakedExposure: true,
    twoUpLock: true,
  },
  doNext: [],
  offers: [],
  races: [],
  settledSinceLastPoll: [],
  nakedExposed: [],
  twoUpTriggered: [],
};

describe("offerExpiringAlertKeys", () => {
  it("covers every actionable kind for today's dedupe keys", () => {
    const keys = offerExpiringAlertKeys(5, NOW);
    expect(keys).toContain("offer_expiring:offer-5-place_qualifying:2026-07-13");
    expect(keys).toContain("offer_expiring:offer-5-convert_free_bet:2026-07-13");
    expect(offerExpiringAlertDedupePrefix(5)).toBe("offer_expiring:offer-5-");
  });
});

describe("offer_expiring rule", () => {
  it("fires inside the expiry lead with EV above the floor", () => {
    const alerts = evaluateAlertRules({
      ...base,
      offers: [offer({ expiresAt: NOW + 90 * MIN })],
      doNext: [doNextItem({ id: "offer-5-place_qualifying", remainingEv: 12, daysLeft: 0.06 })],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "offer_expiring",
      key: "offer_expiring:offer-5-place_qualifying:2026-07-13",
      href: "/offers?view=5",
    });
    expect(alerts[0]!.title).toMatch(/ends in/i);
    expect(alerts[0]!.body).toContain("£12");
  });

  it("stays quiet hours before a course meeting starts", () => {
    const firstOff = NOW + 4 * HOUR;
    const alerts = evaluateAlertRules({
      ...base,
      now: NOW,
      offers: [
        offer({
          sport: "horse_racing",
          eventDate: "2026-07-13",
          scopeCourse: "Galway",
          expiresAt: NOW + 12 * HOUR,
        }),
      ],
      races: [
        {
          eventId: 1,
          course: "Galway",
          offTime: firstOff,
          resultLogged: false,
          openExpected: null,
          hasOpenBet: false,
        },
      ],
      doNext: [doNextItem({ id: "offer-5-place_qualifying", remainingEv: 3.6, daysLeft: 0.5 })],
    });
    expect(alerts).toHaveLength(0);
  });

  it("fires 15 minutes before the first Galway race with contextual copy", () => {
    const firstOff = NOW + 4 * HOUR;
    const alertAt = firstOff - 15 * MIN;
    const alerts = evaluateAlertRules({
      ...base,
      now: alertAt,
      // Isolate offer_expiring from race_off_soon (same 15-minute window).
      prefs: { ...base.prefs, raceOffSoon: false },
      offers: [
        offer({
          sport: "horse_racing",
          eventDate: "2026-07-13",
          scopeCourse: "Galway",
          expiresAt: NOW + 12 * HOUR,
        }),
      ],
      races: [
        {
          eventId: 1,
          course: "Galway",
          offTime: firstOff,
          resultLogged: false,
          openExpected: null,
          hasOpenBet: false,
        },
      ],
      doNext: [
        doNextItem({
          id: "offer-5-place_qualifying",
          remainingEv: 3.6,
          daysLeft: 0.3,
          offerTitle: "Bet £5 get £5 free bet",
        }),
      ],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.title).toBe("Galway off in 15 min - £4 unclaimed");
    expect(alerts[0]!.body).toMatch(/before the off/i);
  });

  it("falls back to the item href when the do-next item has no offer id", () => {
    const alerts = evaluateAlertRules({
      ...base,
      doNext: [
        doNextItem({
          id: "x",
          remainingEv: 12,
          daysLeft: 0.04,
          offerId: null,
          href: "/tracker",
        }),
      ],
    });
    expect(alerts[0]?.href).toBe("/tracker");
  });

  it("stays quiet for low EV, distant expiry, or when toggled off", () => {
    const items = [doNextItem({ id: "a", remainingEv: 0.4, daysLeft: 0.04 })];
    expect(
      evaluateAlertRules({
        ...base,
        offers: [offer({ id: 5, expiresAt: NOW + 60 * MIN })],
        doNext: items,
      })
    ).toHaveLength(0);

    const distant = [doNextItem({ id: "b", remainingEv: 12, daysLeft: 3 })];
    expect(
      evaluateAlertRules({
        ...base,
        offers: [offer({ expiresAt: NOW + 3 * 24 * HOUR })],
        doNext: distant,
      })
    ).toHaveLength(0);

    const toggledOff = [doNextItem({ id: "c", remainingEv: 12, daysLeft: 0.04 })];
    expect(
      evaluateAlertRules({
        ...base,
        offers: [offer({ expiresAt: NOW + 60 * MIN })],
        doNext: toggledOff,
        prefs: { ...base.prefs, offerExpiring: false },
      })
    ).toHaveLength(0);
  });

  it("skips await_result and fund_account items", () => {
    const items = [
      doNextItem({ id: "d", kind: "await_result", remainingEv: 12, daysLeft: 0.04 }),
      doNextItem({ id: "e", kind: "fund_account", remainingEv: 12, daysLeft: 0.04 }),
    ];
    expect(
      evaluateAlertRules({
        ...base,
        offers: [offer({ expiresAt: NOW + 60 * MIN })],
        doNext: items,
      })
    ).toHaveLength(0);
  });

  it("reminds convert_free_bet near promo expiry, not at race off", () => {
    const firstOff = NOW + 30 * MIN;
    const expiresAt = NOW + 10 * HOUR;
    const alertsAtRace = evaluateAlertRules({
      ...base,
      now: firstOff - 10 * MIN,
      prefs: { ...base.prefs, raceOffSoon: false },
      offers: [
        offer({
          sport: "horse_racing",
          eventDate: "2026-07-13",
          scopeCourse: "Galway",
          expiresAt,
        }),
      ],
      races: [
        {
          eventId: 1,
          course: "Galway",
          offTime: firstOff,
          resultLogged: false,
          openExpected: null,
          hasOpenBet: false,
        },
      ],
      doNext: [
        doNextItem({
          id: "offer-5-convert_free_bet",
          kind: "convert_free_bet",
          remainingEv: 4,
          daysLeft: 0.4,
        }),
      ],
    });
    expect(alertsAtRace).toHaveLength(0);

    const alertsNearExpiry = evaluateAlertRules({
      ...base,
      now: expiresAt - 90 * MIN,
      prefs: { ...base.prefs, raceOffSoon: false },
      offers: [
        offer({
          sport: "horse_racing",
          eventDate: "2026-07-13",
          scopeCourse: "Galway",
          expiresAt,
        }),
      ],
      races: [
        {
          eventId: 1,
          course: "Galway",
          offTime: firstOff,
          resultLogged: false,
          openExpected: null,
          hasOpenBet: false,
        },
      ],
      doNext: [
        doNextItem({
          id: "offer-5-convert_free_bet",
          kind: "convert_free_bet",
          remainingEv: 4,
          daysLeft: 0.06,
        }),
      ],
    });
    expect(alertsNearExpiry).toHaveLength(1);
    expect(alertsNearExpiry[0]!.title).toMatch(/ends in/i);
  });
});

describe("race_off_soon rule", () => {
  const race = {
    eventId: 7,
    course: "Kempton",
    offTime: NOW + 12 * MIN,
    resultLogged: false,
    openExpected: 2.4,
    hasOpenBet: false,
  };

  it("fires inside the 15-minute window when the workflow is unfinished (no open bet)", () => {
    const alerts = evaluateAlertRules({ ...base, races: [race] });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "race_off_soon",
      key: "race_off_soon:7",
      href: "/racing",
    });
    expect(alerts[0]!.title).toContain("Kempton");
  });

  it("stays quiet when hedged, past off, outside the window, or toggled off", () => {
    expect(
      evaluateAlertRules({ ...base, races: [{ ...race, hasOpenBet: true }] })
    ).toHaveLength(0);
    expect(
      evaluateAlertRules({ ...base, races: [{ ...race, offTime: NOW - MIN }] })
    ).toHaveLength(0);
    expect(
      evaluateAlertRules({ ...base, races: [{ ...race, offTime: NOW + 40 * MIN }] })
    ).toHaveLength(0);
    expect(
      evaluateAlertRules({
        ...base,
        races: [race],
        prefs: { ...base.prefs, raceOffSoon: false },
      })
    ).toHaveLength(0);
  });
});

describe("result_settled rule", () => {
  it("announces each newly settled bet with its P&L", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        { betId: 42, label: "Haydock 13:35", profit: 4.1 },
        { betId: 43, label: "Kempton EW", profit: -1.51 },
      ],
    });
    expect(alerts.map((a) => a.key)).toEqual([
      "result_settled:42",
      "result_settled:43",
    ]);
    expect(alerts[0]!.body).toContain("+£4.10");
    expect(alerts[1]!.body).toContain("-£1.51");
    expect(alerts[0]!.href).toBe("/tracker?highlight=42");
  });

  it("uses Profit Tracker-style void/push copy with no signed P&L", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        { betId: 7, label: "Winner Regal Desire", profit: 6.52, status: "void" },
        { betId: 8, label: "Push pick", profit: 0, status: "push" },
      ],
    });
    expect(alerts[0]).toMatchObject({
      key: "result_settled:7",
      title: "Voided: Winner Regal Desire",
      body: "Void · stakes returned on Winner Regal Desire.",
    });
    expect(alerts[0]!.body).not.toContain("£");
    expect(alerts[1]).toMatchObject({
      key: "result_settled:8",
      title: "Push: Push pick",
      body: "Push · stakes returned on Push pick.",
    });
  });

  it("respects the toggle", () => {
    expect(
      evaluateAlertRules({
        ...base,
        settledSinceLastPoll: [{ betId: 42, label: "X", profit: 1 }],
        prefs: { ...base.prefs, resultSettled: false },
      })
    ).toHaveLength(0);
  });
});

describe("naked_exposure rule", () => {
  it("alerts per exposed bet and respects the toggle", () => {
    const nakedExposed = [{ betId: 9, label: "Kempton EW", bookmaker: "Bet365" }];
    const alerts = evaluateAlertRules({ ...base, nakedExposed });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "naked_exposure",
      key: "naked_exposure:9",
      href: "/tracker?highlight=9",
    });
    expect(alerts[0]!.body).toContain("Bet365");
    expect(
      evaluateAlertRules({
        ...base,
        nakedExposed,
        prefs: { ...base.prefs, nakedExposure: false },
      })
    ).toHaveLength(0);
  });
});

describe("two_up_lock rule", () => {
  it("includes the lock suggestion when the live model can price it", () => {
    const twoUpTriggered = [
      {
        betId: 12,
        label: "Arsenal 2UP",
        eventName: "Arsenal v Chelsea",
        suggestion: { fairBackOdds: 1.25, backStake: 49.73, lockedProfit: 11.29 },
      },
    ];
    const alerts = evaluateAlertRules({ ...base, twoUpTriggered });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "two_up_lock", key: "two_up_lock:12" });
    expect(alerts[0]!.body).toContain("~1.25");
    expect(alerts[0]!.body).toContain("£49.73");
    expect(alerts[0]!.body).toContain("£11.29");
  });

  it("falls back to plain copy without a suggestion and respects the toggle", () => {
    const twoUpTriggered = [
      { betId: 13, label: "X", eventName: "A v B", suggestion: null },
    ];
    const alerts = evaluateAlertRules({ ...base, twoUpTriggered });
    expect(alerts[0]!.body).toContain("hedge the open lay");
    expect(
      evaluateAlertRules({
        ...base,
        twoUpTriggered,
        prefs: { ...base.prefs, twoUpLock: false },
      })
    ).toHaveLength(0);
  });
});
