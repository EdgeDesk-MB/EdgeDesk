/**
 * Pure hosted Home snapshot from Neon bet rows. No SQLite, no Neon client.
 */
import type { BetRow } from "@/lib/db/schema";
import { computePnlBuckets } from "@/lib/pnl/pnl-buckets";
import { openBetExpectedProfit } from "@/lib/pnl/open-bet-valuation";
import { DEFAULT_SETTINGS } from "@/lib/services/settings-shared";
import { hasApiKey, apiUsageToday } from "@/lib/services/apifootball";
import { hasRacingApiKey, racingApiUsageToday } from "@/lib/services/theracingapi";
import type { AppState } from "@/lib/services/state.types";

const EMPTY_BALANCES: AppState["balances"] = {
  total: 0,
  bookies: 0,
  exchanges: 0,
  banks: 0,
  pendingBankCredits: 0,
  inBets: 0,
  bankroll: 0,
  accounts: [],
};

export function appStateFromNeonBets(allBets: BetRow[]): AppState {
  const bets = [...allBets].sort((a, b) => b.createdAt - a.createdAt);
  const pnl = computePnlBuckets({
    bets,
    casinoOffers: [],
    adjustments: [],
  });

  const settled = bets
    .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
    .sort((a, b) => (a.settledAt ?? a.createdAt) - (b.settledAt ?? b.createdAt));

  let running = 0;
  const series = settled.map((b) => {
    running += b.actualProfit ?? 0;
    return { time: b.settledAt ?? b.createdAt, value: running, commissionPaid: 0 };
  });

  let provisional = 0;
  for (const bet of bets.filter((b) => b.status === "open")) {
    const expected = openBetExpectedProfit(bet);
    if (expected != null) provisional += expected;
  }

  return {
    events: [],
    bets,
    settledProfit: pnl.settledProfit,
    bettingProfit: pnl.bettingProfit,
    casinoProfit: 0,
    provisionalProfit: Math.round(provisional * 100) / 100,
    pnlAdjustments: [],
    casinoSettlements: [],
    planRaces: [],
    planFixtures: [],
    retention: { rate: DEFAULT_SETTINGS.tuning.retentionPrior, sampleSize: 0 },
    effortMeasured: {},
    mugPlans: [],
    accaLayDue: [],
    betBuilderLayDue: [],
    alertsUnread: 0,
    deliveredAlertKeys: [],
    boostsOpen: 0,
    casinoNeedsAction: 0,
    demoMode: false,
    livePositions: [],
    liveEventModels: [],
    series,
    history: [],
    chartHistory: [],
    promoAwards: {},
    apiConfigured: hasApiKey(),
    racingApiConfigured: hasRacingApiKey(),
    racingResultsTier: hasRacingApiKey() ? "free" : "none",
    apiUsage: apiUsageToday(),
    racingApiUsage: racingApiUsageToday(),
    exchangeProvider: "betfair",
    exchangeName: "Betfair",
    exchangeStatus: { provider: "betfair", status: "not_configured" },
    exchangeProviders: [{ provider: "betfair", status: "not_configured" }],
    racingAutopilot: [],
    settings: DEFAULT_SETTINGS,
    balances: EMPTY_BALANCES,
    offers: [],
  };
}
