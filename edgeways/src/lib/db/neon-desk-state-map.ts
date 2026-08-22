/**
 * Pure hosted Home snapshot from Neon rows. No SQLite, no Neon client.
 */
import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
  HistoryRow,
  OfferRow,
} from "@/lib/db/schema";
import { computePnlBuckets } from "@/lib/pnl/pnl-buckets";
import { sumOpenWorstCaseProfit } from "@/lib/pnl/open-bet-worst-case";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/services/settings-shared";
import { hasApiKey, apiUsageToday } from "@/lib/services/apifootball";
import { hasRacingApiKey, racingApiUsageToday } from "@/lib/services/theracingapi";
import { summariseOffer } from "@/lib/offers/offer-profit";
import { balanceSummaryFromRows } from "@/lib/services/balance-summary";
import type { AppState } from "@/lib/services/state.types";

export type NeonDeskSnapshot = {
  bets: BetRow[];
  offers?: OfferRow[];
  accounts?: AccountRow[];
  transactions?: BalanceTransactionRow[];
  history?: HistoryRow[];
  settings?: AppSettings;
};

export function appStateFromNeonDesk(input: NeonDeskSnapshot): AppState {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const allBets = input.bets;
  const allOffers = input.offers ?? [];
  const accounts = input.accounts ?? [];
  const transactions = input.transactions ?? [];
  const historyRows = input.history ?? [];

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

  const provisional = sumOpenWorstCaseProfit(bets);

  // No promo ledger on Neon yet: pass {} so the pure summary never touches SQLite.
  const offers = allOffers
    .map((o) => summariseOffer(o, allBets.filter((b) => b.offerId === o.id), {}))
    .sort((a, b) => b.createdAt - a.createdAt);

  const balances = balanceSummaryFromRows(accounts, transactions, allBets);

  const history = [...historyRows].sort(
    (a, b) => b.createdAt - a.createdAt || b.id - a.id
  );

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
    hostedDesk: true,
    livePositions: [],
    liveEventModels: [],
    series,
    history,
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
    settings,
    balances,
    offers,
  };
}

/** Bets-only snapshot (first cutover slice); kept for existing tests. */
export function appStateFromNeonBets(
  allBets: BetRow[],
  settings: AppSettings = DEFAULT_SETTINGS
): AppState {
  return appStateFromNeonDesk({ bets: allBets, settings });
}
