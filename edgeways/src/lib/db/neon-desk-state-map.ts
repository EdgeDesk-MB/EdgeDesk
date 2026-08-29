/**
 * Pure hosted Home snapshot from Neon rows. No SQLite, no Neon client.
 */
import type {
  AccountRow,
  BalanceTransactionRow,
  BetRow,
  CasinoOfferRow,
  EventRow,
  HistoryRow,
  OfferRow,
} from "@/lib/db/schema";
import { computePnlBuckets } from "@/lib/pnl/pnl-buckets";
import { sumOpenWorstCaseProfit } from "@/lib/pnl/open-bet-worst-case";
import { isCasinoInMainFeed } from "@/lib/offers/casino-list-groups";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/services/settings-shared";
import { hasApiKey, apiUsageToday } from "@/lib/services/apifootball";
import { hasRacingApiKey, racingApiUsageToday } from "@/lib/services/theracingapi";
import { freeBetBalanceByAccountFromTransactions } from "@/lib/accounts/free-bet-lot-math";
import { promoAwardsFromTransactions } from "@/lib/accounts/promo-awards";
import { summariseOffer } from "@/lib/offers/offer-profit";
import { balanceSummaryFromRows } from "@/lib/services/balance-summary";
import { hostedEventDerivations } from "@/lib/db/neon-desk-state-events";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  wholeComboLay,
} from "@/lib/calc/bet-builder-workflow";
import { indexOfferDeskProgress } from "@/lib/offers/offer-desk-progress";
import { legDueState, type AccaRunView } from "@/lib/services/acca-desk";
import type {
  BetBuilderRunRow,
  BetBuilderSelectionRow,
  SystemLegRow,
  SystemRunRow,
} from "@/lib/db/schema";
import type { AppState } from "@/lib/services/state.types";

export type NeonDeskSnapshot = {
  bets: BetRow[];
  /** Global feed events (EDGE-81b). Not clerk-scoped; shared by every desk. */
  events?: EventRow[];
  offers?: OfferRow[];
  accounts?: AccountRow[];
  transactions?: BalanceTransactionRow[];
  history?: HistoryRow[];
  /** Casino campaigns (casino cutover); drives casinoProfit + settlements. */
  casinoOffers?: CasinoOfferRow[];
  settings?: AppSettings;
  /** Durable Neon usage (EDGE-81c); falls back to this instance's counter. */
  apiUsage?: { used: number; budget: number };
  /** Hosted alerts inbox badge + watcher seen-set (EDGE-110). */
  alertsUnread?: number;
  deliveredAlertKeys?: string[];
  effortMeasured?: AppState["effortMeasured"];
  mugPlans?: AppState["mugPlans"];
  boostsOpen?: number;
  accaLayDue?: AppState["accaLayDue"];
  betBuilderLayDue?: AppState["betBuilderLayDue"];
  deskRuns?: {
    acca?: AccaRunView[];
    systems?: Array<{ run: SystemRunRow; legs: SystemLegRow[] }>;
    betBuilder?: Array<{ run: BetBuilderRunRow; selections: BetBuilderSelectionRow[] }>;
  };
};

export function appStateFromNeonDesk(input: NeonDeskSnapshot): AppState {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const allBets = input.bets;
  const allOffers = input.offers ?? [];
  const accounts = input.accounts ?? [];
  const transactions = input.transactions ?? [];
  const historyRows = input.history ?? [];

  const bets = [...allBets].sort((a, b) => b.createdAt - a.createdAt);
  const allCasinoOffers = input.casinoOffers ?? [];
  // P&L-affecting manual adjustments live in the restored history feed.
  const balanceAdjustments = historyRows.filter(
    (h) => h.kind === "balance_adjustment"
  );
  const pnl = computePnlBuckets({
    bets,
    casinoOffers: allCasinoOffers,
    adjustments: balanceAdjustments,
  });

  const settled = bets
    .filter((b) => b.status !== "open" && b.status !== "void" && b.actualProfit != null)
    .sort((a, b) => (a.settledAt ?? a.createdAt) - (b.settledAt ?? b.createdAt));

  const casinoSettlements = allCasinoOffers
    .filter((o) => o.status === "completed" && o.actualProfit != null)
    .map((o) => ({
      id: o.id,
      time: o.completedAt ?? o.createdAt,
      amount: o.actualProfit!,
      title: o.title,
      casino: o.casino,
    }))
    .sort((a, b) => a.time - b.time);

  const pnlAdjustments = balanceAdjustments
    .filter((h) => h.amount != null && h.amount !== 0)
    .map((h) => ({ id: h.id, time: h.createdAt, amount: h.amount!, detail: h.detail }));

  // Cumulative P&L: settled bets + casino settlements + manual adjustments,
  // same blend as the local snapshot (commission tracking stays local-only).
  const pnlPoints = [
    ...settled.map((b) => ({ time: b.settledAt ?? b.createdAt, profit: b.actualProfit ?? 0 })),
    ...casinoSettlements.map((c) => ({ time: c.time, profit: c.amount })),
    ...balanceAdjustments
      .filter((h) => h.amount != null)
      .map((h) => ({ time: h.createdAt, profit: h.amount! })),
  ].sort((a, b) => a.time - b.time);
  let running = 0;
  const series = pnlPoints.map((p) => {
    running += p.profit;
    return { time: p.time, value: running, commissionPaid: 0 };
  });

  const provisional = sumOpenWorstCaseProfit(bets);

  const promoAwards = promoAwardsFromTransactions(transactions);
  const deskByOffer = indexOfferDeskProgress({
    acca: (input.deskRuns?.acca ?? []).map(({ run, legs }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      method: run.method,
      noLay: run.noLay,
      wholeLayStake: run.wholeLayStake,
      legs: legs.map((l) => ({
        seq: l.seq,
        label: l.label,
        result: l.result,
        layStake: l.layStake,
      })),
    })),
    betBuilder: (input.deskRuns?.betBuilder ?? []).map(({ run, selections }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      method: run.method,
      wholeLayStake: run.wholeLayStake,
      selectionCount: selections.length,
    })),
    systems: (input.deskRuns?.systems ?? []).map(({ run, legs }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      legs: legs.map((l) => ({
        seq: l.seq,
        label: l.label,
        result: l.result,
      })),
    })),
  });
  const nowMs = Date.now();
  const accaLayDue =
    input.accaLayDue ??
    (input.deskRuns?.acca ?? []).flatMap(({ run, legs }) =>
      legs
        .map((leg) => ({ leg, due: legDueState(run, legs, leg, nowMs) }))
        .filter(({ due }) => due.due)
        .map(({ leg, due }) => ({
          legId: leg.id,
          runLabel: run.label,
          legLabel: leg.label,
          seq: leg.seq,
          scheduledAt: leg.scheduledAt,
          suggestedStake: due.suggestedStake,
        }))
    );
  const betBuilderLayDue =
    input.betBuilderLayDue ??
    (input.deskRuns?.betBuilder ?? []).flatMap(({ run }) => {
      if (run.status !== "active" || run.method !== "combined" || run.wholeLayBetId != null) {
        return [];
      }
      if (run.muteAlerts) return [];
      if (run.scheduledAt != null && run.scheduledAt - nowMs > DEFAULT_LAY_LEAD_MINUTES * 60_000) {
        return [];
      }
      if (run.scheduledAt != null && run.scheduledAt < nowMs - LAY_DUE_EXPIRY_MS) return [];
      const suggestion =
        run.backOdds > 1
          ? wholeComboLay({
              stake: run.stake,
              combinedOdds: run.backOdds,
              layOdds: run.backOdds,
              commission: run.commission,
            })
          : null;
      return [
        {
          runId: run.id,
          label: run.label,
          suggestedStake: suggestion?.layStake ?? null,
        },
      ];
    });
  const offers = allOffers
    .map((o) => ({
      ...summariseOffer(o, allBets.filter((b) => b.offerId === o.id), promoAwards),
      deskProgress: deskByOffer.get(o.id) ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  const balances = balanceSummaryFromRows(
    accounts,
    transactions,
    allBets,
    freeBetBalanceByAccountFromTransactions(accounts, transactions)
  );

  const history = [...historyRows].sort(
    (a, b) => b.createdAt - a.createdAt || b.id - a.id
  );

  const derived = hostedEventDerivations(input.events ?? [], bets, offers);

  return {
    events: derived.events,
    bets,
    settledProfit: pnl.settledProfit,
    bettingProfit: pnl.bettingProfit,
    casinoProfit: pnl.casinoProfit,
    provisionalProfit: Math.round(provisional * 100) / 100,
    pnlAdjustments,
    casinoSettlements,
    planRaces: derived.planRaces,
    planFixtures: derived.planFixtures,
    retention: { rate: DEFAULT_SETTINGS.tuning.retentionPrior, sampleSize: 0 },
    effortMeasured: input.effortMeasured ?? {},
    mugPlans: input.mugPlans ?? [],
    accaLayDue,
    betBuilderLayDue,
    alertsUnread: input.alertsUnread ?? 0,
    deliveredAlertKeys: input.deliveredAlertKeys ?? [],
    boostsOpen: input.boostsOpen ?? 0,
    casinoNeedsAction: allCasinoOffers.filter((o) => isCasinoInMainFeed(o)).length,
    demoMode: false,
    hostedDesk: true,
    livePositions: derived.livePositions,
    liveEventModels: derived.liveEventModels,
    series,
    history,
    chartHistory: [],
    promoAwards,
    apiConfigured: hasApiKey(),
    racingApiConfigured: hasRacingApiKey(),
    racingResultsTier: hasRacingApiKey() ? "free" : "none",
    apiUsage: input.apiUsage ?? apiUsageToday(),
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
