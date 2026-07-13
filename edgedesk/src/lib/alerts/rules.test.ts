import { describe, expect, it } from "vitest";
import type { DoNextItem } from "@/lib/offers/do-next";
import { evaluateAlertRules, type AlertRuleInput } from "./rules";

/** 2026-07-13 09:00 local */
const NOW = new Date(2026, 6, 13, 9, 0, 0).getTime();
const MIN = 60_000;

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

const base: AlertRuleInput = {
  now: NOW,
  prefs: { offerExpiring: true, raceOffSoon: true, resultSettled: true },
  doNext: [],
  races: [],
  settledSinceLastPoll: [],
};

describe("offer_expiring rule", () => {
  it("fires for actionable offers ending today with EV above the floor", () => {
    const alerts = evaluateAlertRules({
      ...base,
      doNext: [doNextItem({ id: "offer-5-place_qualifying", remainingEv: 12, daysLeft: 0.4 })],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      kind: "offer_expiring",
      key: "offer_expiring:offer-5-place_qualifying:2026-07-13",
      href: "/offers",
    });
    expect(alerts[0]!.body).toContain("£12");
  });

  it("stays quiet for low EV, distant expiry, or when toggled off", () => {
    const items = [doNextItem({ id: "a", remainingEv: 0.4, daysLeft: 0.4 })];
    expect(evaluateAlertRules({ ...base, doNext: items })).toHaveLength(0);

    const distant = [doNextItem({ id: "b", remainingEv: 12, daysLeft: 3 })];
    expect(evaluateAlertRules({ ...base, doNext: distant })).toHaveLength(0);

    const toggledOff = [doNextItem({ id: "c", remainingEv: 12, daysLeft: 0.4 })];
    expect(
      evaluateAlertRules({
        ...base,
        doNext: toggledOff,
        prefs: { ...base.prefs, offerExpiring: false },
      })
    ).toHaveLength(0);
  });

  it("skips await_result and fund_account items", () => {
    const items = [
      doNextItem({ id: "d", kind: "await_result", remainingEv: 12, daysLeft: 0.2 }),
      doNextItem({ id: "e", kind: "fund_account", remainingEv: 12, daysLeft: 0.2 }),
    ];
    expect(evaluateAlertRules({ ...base, doNext: items })).toHaveLength(0);
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
