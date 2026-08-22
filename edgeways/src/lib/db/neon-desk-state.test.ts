import { describe, expect, it } from "vitest";
import { appStateFromNeonBets } from "@/lib/db/neon-desk-state-map";
import type { BetRow } from "@/lib/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/services/settings-shared";

function bet(partial: Partial<BetRow> & Pick<BetRow, "id" | "label" | "status">): BetRow {
  return {
    eventId: null,
    market: "match_odds",
    selection: "",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: null,
    backStake: 10,
    backOdds: 2,
    layStake: 0,
    layOdds: 0,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    expectedProfit: 0.4,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: 1_700_000_000_000,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: "football",
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

describe("appStateFromNeonBets", () => {
  it("returns an empty desk without touching SQLite", () => {
    const state = appStateFromNeonBets([]);
    expect(state.bets).toEqual([]);
    expect(state.settledProfit).toBe(0);
    expect(state.offers).toEqual([]);
    expect(state.balances.accounts).toEqual([]);
    expect(state.demoMode).toBe(false);
    expect(state.settings.ageConfirmedAt).toBeNull();
  });

  it("keeps a hosted age confirmation on the snapshot", () => {
    const state = appStateFromNeonBets([], {
      ...DEFAULT_SETTINGS,
      ageConfirmedAt: 1_754_870_400_000,
    });
    expect(state.settings.ageConfirmedAt).toBe(1_754_870_400_000);
  });

  it("shows a hosted bet and settled P&L", () => {
    const state = appStateFromNeonBets([
      bet({
        id: 1,
        label: "Man Utd",
        status: "won",
        actualProfit: 1.25,
        settledAt: 1_700_000_100_000,
      }),
      bet({
        id: 2,
        label: "Open",
        status: "open",
        expectedProfit: 0.5,
        createdAt: 1_700_000_200_000,
      }),
    ]);
    expect(state.bets.map((b) => b.label)).toEqual(["Open", "Man Utd"]);
    expect(state.settledProfit).toBe(1.25);
    expect(state.series).toHaveLength(1);
    expect(state.series[0]?.value).toBe(1.25);
    expect(state.provisionalProfit).toBe(0.5);
  });
});
