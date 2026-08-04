import { describe, expect, it } from "vitest";
import type { BetRow } from "@/lib/db/schema";
import {
  INTENTIONAL_NOHEDGE_MARKER,
  detectNakedExposure,
  isNakedExposed,
  markIntentionalNoHedge,
  nakedExposureAlertKey,
} from "./naked-exposure";

const NOW = new Date(2026, 6, 14, 9, 0, 0).getTime();
const MIN = 60_000;

function bet(over: Partial<BetRow> & Pick<BetRow, "id">): BetRow {
  return {
    eventId: null,
    label: `Bet ${over.id}`,
    market: "win",
    selection: "Horse",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 50,
    backOdds: 4,
    layStake: 0,
    layOdds: 0,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: null,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: NOW - 15 * MIN,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    ...over,
  };
}

describe("isNakedExposed - clause by clause", () => {
  const exposed = bet({ id: 1 }); // open qualifying, back £50, no lay, 15 min old

  it("fires for an aged, unhedged qualifying back", () => {
    expect(isNakedExposed(exposed, NOW)).toBe(true);
  });

  it("fires for risk_free too", () => {
    expect(isNakedExposed(bet({ id: 2, betType: "risk_free" }), NOW)).toBe(true);
  });

  it("never fires for free bets (routinely unhedged by design)", () => {
    expect(isNakedExposed(bet({ id: 3, betType: "free_snr" }), NOW)).toBe(false);
    expect(isNakedExposed(bet({ id: 4, betType: "free_sr" }), NOW)).toBe(false);
    expect(isNakedExposed(bet({ id: 5, betType: "back_only" }), NOW)).toBe(false);
    expect(isNakedExposed(bet({ id: 6, betType: "lay_only" }), NOW)).toBe(false);
  });

  it("requires open status, a back stake, and no lay", () => {
    expect(isNakedExposed(bet({ id: 7, status: "won" }), NOW)).toBe(false);
    expect(isNakedExposed(bet({ id: 8, backStake: 0 }), NOW)).toBe(false);
    expect(isNakedExposed(bet({ id: 9, layStake: 48 }), NOW)).toBe(false);
  });

  it("excludes dutch bets - legs hedge internally", () => {
    expect(
      isNakedExposed(bet({ id: 10, legs: JSON.stringify([{ label: "A" }]) }), NOW)
    ).toBe(false);
  });

  it("respects the 10-minute default threshold", () => {
    expect(isNakedExposed(bet({ id: 11, createdAt: NOW - 9 * MIN }), NOW)).toBe(false);
    expect(isNakedExposed(bet({ id: 12, createdAt: NOW - 11 * MIN }), NOW)).toBe(true);
  });

  it("tightens to 3 minutes when the event starts within the hour", () => {
    const soon = NOW + 45 * MIN; // event in 45 min
    expect(
      isNakedExposed(bet({ id: 13, createdAt: NOW - 5 * MIN }), NOW, soon)
    ).toBe(true);
    expect(
      isNakedExposed(bet({ id: 14, createdAt: NOW - 2 * MIN }), NOW, soon)
    ).toBe(false);
    // Distant event keeps the 10-minute default
    expect(
      isNakedExposed(bet({ id: 15, createdAt: NOW - 5 * MIN }), NOW, NOW + 3 * 60 * MIN)
    ).toBe(false);
    // In-play (event already started) is the most urgent case - tight window
    expect(
      isNakedExposed(bet({ id: 17, createdAt: NOW - 5 * MIN }), NOW, NOW - 10 * MIN)
    ).toBe(true);
  });

  it("honours the intentional-nohedge mute marker", () => {
    expect(
      isNakedExposed(bet({ id: 16, notes: `some note ${INTENTIONAL_NOHEDGE_MARKER}` }), NOW)
    ).toBe(false);
  });

  it("mug bets are deliberately unlaid - never exposed (J5)", () => {
    expect(
      isNakedExposed(bet({ id: 17, purpose: "mug" }), NOW)
    ).toBe(false);
  });

  it("honours E1 tuning overrides for both windows", () => {
    // 15-min-old back: exposed at the 10-min default, safe at a 20-min override
    expect(isNakedExposed(bet({ id: 18 }), NOW, null, { thresholdMs: 20 * MIN })).toBe(false);
    expect(isNakedExposed(bet({ id: 19 }), NOW, null, { thresholdMs: 14 * MIN })).toBe(true);
    // Imminent event, 2-min-old back: safe at the 3-min default, exposed at 1 min
    const soon = NOW + 45 * MIN;
    expect(
      isNakedExposed(bet({ id: 20, createdAt: NOW - 2 * MIN }), NOW, soon, {
        imminentThresholdMs: 1 * MIN,
      })
    ).toBe(true);
  });
});

describe("detectNakedExposure", () => {
  it("maps event start times and returns exposed bets only", () => {
    const bets = [
      bet({ id: 1 }), // exposed
      bet({ id: 2, eventId: 9, createdAt: NOW - 5 * MIN }), // event soon → 3 min threshold → exposed
      bet({ id: 3, layStake: 48 }), // hedged
    ];
    const eventStarts = new Map([[9, NOW + 30 * MIN]]);
    expect(detectNakedExposure(bets, eventStarts, NOW).map((b) => b.id)).toEqual([1, 2]);
  });
});

describe("markIntentionalNoHedge", () => {
  it("appends the marker, preserving existing notes", () => {
    expect(markIntentionalNoHedge(null)).toBe(INTENTIONAL_NOHEDGE_MARKER);
    expect(markIntentionalNoHedge("lay later")).toBe(
      `lay later ${INTENTIONAL_NOHEDGE_MARKER}`
    );
    // Idempotent
    expect(markIntentionalNoHedge(INTENTIONAL_NOHEDGE_MARKER)).toBe(
      INTENTIONAL_NOHEDGE_MARKER
    );
  });

  it("matches the alert dedupe key used by AlertWatcher", () => {
    expect(nakedExposureAlertKey(97)).toBe("naked_exposure:97");
  });
});
