import { describe, expect, it } from "vitest";
import {
  hasDeskActivity,
  shouldShowDashboardEmptyCta,
} from "@/lib/dashboard-empty";
import type { AppState } from "@/lib/services/state.types";

function baseState(overrides: Partial<AppState> = {}): AppState {
  return {
    events: [],
    bets: [],
    settledProfit: 0,
    provisionalProfit: 0,
    retention: { rate: 0, sampleSize: 0 },
    effortMeasured: {},
    accaLayDue: [],
    mugPlans: [],
    alertsUnread: 0,
    demoMode: false,
    livePositions: [],
    liveEventModels: [],
    series: [],
    pnlAdjustments: [],
    planRaces: [],
    planFixtures: [],
    history: [],
    chartHistory: [],
    promoAwards: {},
    apiConfigured: false,
    racingApiConfigured: false,
    racingResultsTier: "none",
    apiUsage: { used: 0, budget: 0 },
    racingApiUsage: { used: 0 },
    exchangeProvider: "betfair",
    exchangeName: "Betfair",
    exchangeStatus: {
      provider: "betfair",
      status: "not_configured",
    },
    exchangeProviders: [],
    racingAutopilot: [],
    settings: {} as AppState["settings"],
    balances: {
      total: 0,
      bookies: 0,
      exchanges: 0,
      banks: 0,
      pendingBankCredits: 0,
      inBets: 0,
      bankroll: 0,
      accounts: [],
    },
    offers: [],
    ...overrides,
  };
}

describe("shouldShowDashboardEmptyCta", () => {
  it("is false while state has not loaded (avoids refresh flash)", () => {
    expect(shouldShowDashboardEmptyCta(null)).toBe(false);
  });

  it("is true for a truly empty desk", () => {
    expect(shouldShowDashboardEmptyCta(baseState())).toBe(true);
  });

  it("is false when bets exist", () => {
    expect(
      shouldShowDashboardEmptyCta(
        baseState({ bets: [{ id: 1 } as AppState["bets"][number]] })
      )
    ).toBe(false);
  });

  it("is false when history exists even with no bets", () => {
    expect(
      shouldShowDashboardEmptyCta(
        baseState({ history: [{ id: 1 } as AppState["history"][number]] })
      )
    ).toBe(false);
  });

  it("is false when settled profit is non-zero", () => {
    expect(shouldShowDashboardEmptyCta(baseState({ settledProfit: 12.5 }))).toBe(
      false
    );
  });
});

describe("hasDeskActivity", () => {
  it("is false for empty desk", () => {
    expect(hasDeskActivity(baseState())).toBe(false);
  });

  it("is true when tracked events exist", () => {
    expect(
      hasDeskActivity(baseState({ events: [{ id: 1 } as AppState["events"][number]] }))
    ).toBe(true);
  });
});
