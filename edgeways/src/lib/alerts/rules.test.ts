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
    rules: JSON.stringify({ betStake: 10, freeBetAmount: 10 }),
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
    expect(alerts[0]!.title).toMatch(/⚡ £12 edge ends in/i);
    expect(alerts[0]!.body).toMatch(/place the £10 qualifying bet before/i);
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
          title: "Bet £5 get £5 free bet",
          sport: "horse_racing",
          eventDate: "2026-07-13",
          scopeCourse: "Galway",
          expiresAt: NOW + 12 * HOUR,
          offerType: "bet_get_free_place",
          rules: JSON.stringify({
            type: "bet_get_free_place",
            minRunners: 8,
            regions: ["GB", "IRE"],
            qualifyingPlaces: [2, 3, 4],
            betStake: 5,
            freeBetAmount: 5,
          }),
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
          fieldSize: 12,
        },
        {
          eventId: 2,
          course: "Galway",
          offTime: firstOff + 30 * MIN,
          resultLogged: false,
          openExpected: null,
          hasOpenBet: false,
          fieldSize: 6,
        },
        {
          eventId: 3,
          course: "Galway",
          offTime: firstOff + 60 * MIN,
          resultLogged: false,
          openExpected: null,
          hasOpenBet: false,
          fieldSize: 10,
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
    expect(alerts[0]!.title).toBe("⚡ £4 edge · Galway starts in 15 minutes");
    expect(alerts[0]!.body).toMatch(
      /^Bet £5 get £5 free bet · place the £5 qualifying bet · first race /
    );
    expect(alerts[0]!.body).toMatch(/ · 2 races qualify$/);
    expect(alerts[0]!.bookmaker).toBe("Bet365");
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
        {
          betId: 42,
          label: "Qualify · Ivybet",
          profit: 4.1,
          status: "won",
          betType: "qualifying",
          offerTitle: "Bet £10 get £10 free bet",
          bookmaker: "Ivybet",
        },
        {
          betId: 43,
          label: "Kempton EW",
          profit: -1.51,
          status: "lost",
          betType: "free_snr",
          offerTitle: "Bet £10 get £10 free bet",
          bookmaker: "Bet365",
        },
      ],
    });
    expect(alerts.map((a) => a.key)).toEqual([
      "result_settled:42",
      "result_settled:43",
    ]);
    expect(alerts[0]).toMatchObject({
      title: "You just made £4.10 · Bet won",
      body: "Qualifying · Bet £10 get £10 free bet",
      bookmaker: "Ivybet",
      tone: "positive",
    });
    expect(alerts[1]).toMatchObject({
      title: "-£1.51 settled · Bet lost",
      body: "Free bet · Bet £10 get £10 free bet",
      bookmaker: "Bet365",
      tone: "negative",
    });
    expect(alerts[0]!.href).toBe("/tracker?highlight=42");
  });

  it("leads the body with a race or match result when provided", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        {
          betId: 42,
          label: "Galway 14:00",
          profit: 4.1,
          status: "won",
          betType: "qualifying",
          offerTitle: "Bet £20 get £20 free bet",
          bookmaker: "Betfair Sportsbook",
          resultSummary: "Finished 4th",
        },
        {
          betId: 43,
          label: "Arsenal v Chelsea",
          profit: -1.51,
          status: "lost",
          betType: "qualifying",
          bookmaker: "Bet365",
          resultSummary: "2–1",
        },
      ],
    });
    expect(alerts[0]!.body).toBe(
      "Finished 4th · Qualifying · Bet £20 get £20 free bet"
    );
    expect(alerts[1]!.body).toBe("2–1 · Qualifying · Arsenal v Chelsea");
  });

  it("falls back to the bet label when there is no linked offer", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        {
          betId: 42,
          label: "Haydock 13:35",
          profit: 4.1,
          status: "won",
          betType: "qualifying",
          bookmaker: "Paddy Power",
        },
      ],
    });
    expect(alerts[0]!.title).toBe("You just made £4.10 · Bet won");
    expect(alerts[0]!.body).toBe("Qualifying · Haydock 13:35");
    expect(alerts[0]!.bookmaker).toBe("Paddy Power");
  });

  it("keeps P&L-only titles when settlement status is unknown", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        { betId: 42, label: "X", profit: 1.5 },
        { betId: 43, label: "Y", profit: -0.5 },
      ],
    });
    expect(alerts[0]!.title).toBe("You just made £1.50");
    expect(alerts[1]!.title).toBe("-£0.50 settled");
  });

  it("appends early payout and half-result outcomes after the amount", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        {
          betId: 1,
          label: "2UP",
          profit: 3.2,
          status: "early_payout",
          betType: "qualifying",
        },
        {
          betId: 2,
          label: "EW place",
          profit: 1.1,
          status: "half_win",
          betType: "qualifying",
        },
        {
          betId: 3,
          label: "EW place lose",
          profit: -0.8,
          status: "half_lose",
          betType: "qualifying",
        },
      ],
    });
    expect(alerts[0]!.title).toBe("You just made £3.20 · 2UP paid early");
    expect(alerts[1]!.title).toBe("You just made £1.10 · Bet half won");
    expect(alerts[2]!.title).toBe("-£0.80 settled · Bet half lost");
  });

  it("uses Profit Tracker-style void/push copy with no signed P&L", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        {
          betId: 7,
          label: "Winner Regal Desire",
          profit: 6.52,
          status: "void",
          betType: "qualifying",
          offerTitle: "Bet £5 get £5 free bet",
          bookmaker: "Paddy Power",
        },
        {
          betId: 8,
          label: "Push pick",
          profit: 0,
          status: "push",
          betType: "qualifying",
        },
      ],
    });
    expect(alerts[0]).toMatchObject({
      key: "result_settled:7",
      title: "Void · stakes returned",
      body: "Qualifying · Bet £5 get £5 free bet",
      bookmaker: "Paddy Power",
      tone: null,
    });
    expect(alerts[0]!.title).not.toContain("£");
    expect(alerts[1]).toMatchObject({
      key: "result_settled:8",
      title: "Push · stakes returned",
      body: "Qualifying · Push pick",
      tone: null,
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

  it("skips Acca desk lay losses (next-lay push owns that moment)", () => {
    const alerts = evaluateAlertRules({
      ...base,
      settledSinceLastPoll: [
        {
          betId: 10,
          label: "Acca lay · Middlesbrough",
          profit: -16.2,
          status: "lost",
          betType: "lay_only",
        },
        {
          betId: 11,
          label: "Qualify · Ivybet",
          profit: 2,
          status: "won",
          betType: "qualifying",
        },
        {
          betId: 12,
          label: "Acca lay · Cambridge United",
          profit: 36.2,
          status: "won",
          betType: "lay_only",
        },
      ],
    });
    expect(alerts.map((a) => a.key)).toEqual([
      "result_settled:11",
      "result_settled:12",
    ]);
    expect(alerts[1]).toMatchObject({
      title: "You just made £36.20 · Bet won",
      body: "Lay · Acca lay · Cambridge United",
    });
  });
});

describe("naked_exposure rule", () => {
  it("alerts per exposed bet and respects the toggle", () => {
    const nakedExposed = [
      {
        betId: 9,
        label: "Kempton EW",
        bookmaker: "Bet365",
        betType: "qualifying",
        offerTitle: "Bet £20 get £10 free bet",
      },
    ];
    const alerts = evaluateAlertRules({ ...base, nakedExposed });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "naked_exposure",
      key: "naked_exposure:9",
      href: "/tracker?highlight=9",
    });
    expect(alerts[0]).toMatchObject({
      title: "⚠️ Lay missing · full stake exposed",
      body: "Qualifying · Bet £20 get £10 free bet",
      bookmaker: "Bet365",
    });
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
    expect(alerts[0]).toMatchObject({
      kind: "two_up_lock",
      key: "two_up_lock:12",
      title: "🔒 2UP · lock £11.29",
      body: "Arsenal v Chelsea · back ~1.25 for £49.73",
    });
  });

  it("falls back to plain copy without a suggestion and respects the toggle", () => {
    const twoUpTriggered = [
      { betId: 13, label: "X", eventName: "A v B", suggestion: null },
    ];
    const alerts = evaluateAlertRules({ ...base, twoUpTriggered });
    expect(alerts[0]).toMatchObject({
      title: "🔒 2UP · hedge the lay",
      body: "A v B · early payout is in",
    });
    expect(
      evaluateAlertRules({
        ...base,
        twoUpTriggered,
        prefs: { ...base.prefs, twoUpLock: false },
      })
    ).toHaveLength(0);
  });
});
