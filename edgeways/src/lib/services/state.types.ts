/**
 * Client-safe app state types (no SQLite / server services).
 */
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import type { DailyPlanFixtureInput, DailyPlanRaceInput } from "@/lib/plan/daily-plan";
import type { BalanceSummary } from "@/lib/services/balances.types";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AppSettings } from "@/lib/services/settings-shared";
import type { ExchangeProviderStatus } from "@/lib/services/exchange/types";

export type RacingResultsTier = "basic" | "free" | "none";

export type LivePositionKind = "bet" | "acca" | "bet_builder" | "systems";

export interface LivePosition {
  betId: number;
  /** Event this position is attached to — used to sum "if ended now" on Home Events. */
  eventId?: number;
  /** Desk campaign row. Default is a normal tracker bet. */
  kind?: LivePositionKind;
  /** Positions row target. Default `/tracker`. */
  href?: string;
  label: string;
  eventName: string;
  eventSport?: string;
  eventStatusLabel: string;
  minute: number;
  /** @deprecated use eventStatusLabel */
  score: string;
  provisional: number | null;
  snapshotProvisional: number | null;
  valuationMode: "model" | "snapshot";
  expected: number | null;
  triggerNote: string | null;
}

export interface RacingAutopilotNotice {
  id: number;
  message: string;
}

export interface LiveEventModel {
  eventId: number;
  marketsLabel: string;
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface RetentionState {
  rate: number;
  sampleSize: number;
}

export interface AppState {
  events: EventRow[];
  bets: BetRow[];
  /** Total retained P&L = bettingProfit + casinoProfit + manual P&L adjustments. */
  settledProfit: number;
  /** Settled sports/matched-bet P&L only. */
  bettingProfit: number;
  /** Completed casino campaign realised P&L only. */
  casinoProfit: number;
  provisionalProfit: number;
  retention: RetentionState;
  /** J1: per-action-kind median execution minutes from logged samples */
  effortMeasured: Record<string, { minutes: number; sampleSize: number }>;
  /** J7: lay-due acca legs for the Daily Plan and desk badges */
  accaLayDue: Array<{
    legId: number;
    runLabel: string;
    legLabel: string;
    seq: number;
    scheduledAt: number | null;
    suggestedStake: number | null;
  }>;
  /** Bet Builder Desk: combined runs awaiting a whole lay */
  betBuilderLayDue: Array<{
    runId: number;
    label: string;
    suggestedStake: number | null;
  }>;
  /** J5: mug-bet cadence plans joined to account names */
  mugPlans: Array<{
    id: number;
    accountId: number;
    accountName: string;
    cadenceDays: number;
    monthlyBudget: number | null;
    lastMugAt: number | null;
  }>;
  /** Unread alerts in the inbox (F2) - drives the nav badge */
  alertsUnread: number;
  /**
   * Inbox dedupe keys already delivered on this desk (read or unread).
   * AlertWatcher treats these as seen so a new session cannot re-toast them.
   */
  deliveredAlertKeys: string[];
  /** Open boost diary rows (outcome unset) - drives the Boosts nav badge */
  boostsOpen: number;
  /** Planned/active casino campaigns still in the main feed - Casino nav badge */
  casinoNeedsAction: number;
  /** True when this process opened the demo database (G2 watermark) */
  demoMode: boolean;
  /** True when the desk is served from Neon (hosted preview/live), not SQLite */
  hostedDesk?: boolean;
  livePositions: LivePosition[];
  liveEventModels: LiveEventModel[];
  /** Cumulative retained P&L; commissionPaid is cumulative exchange commission, so gross = value + commissionPaid. */
  series: { time: number; value: number; commissionPaid: number }[];
  /** P&L-affecting balance adjustments (chart markers alongside settled bets). */
  pnlAdjustments: { id: number; time: number; amount: number; detail: string | null }[];
  /**
   * Completed casino campaigns as P&L points (source of Casino P&L).
   * Kept separate from bets so the UI can show Betting vs Casino later.
   */
  casinoSettlements: {
    id: number;
    time: number;
    amount: number;
    title: string;
    casino: string | null;
  }[];
  /** Daily Plan (B1) slot inputs: today's tracked races and fixtures with bets. */
  planRaces: DailyPlanRaceInput[];
  planFixtures: DailyPlanFixtureInput[];
  history: HistoryRow[];
  chartHistory: HistoryRow[];
  promoAwards: Record<number, { amount: number; reason: string }>;
  apiConfigured: boolean;
  racingApiConfigured: boolean;
  racingResultsTier: RacingResultsTier;
  apiUsage: { used: number; budget: number };
  racingApiUsage: { used: number };
  exchangeProvider: string;
  exchangeName: string;
  exchangeStatus: ExchangeProviderStatus;
  exchangeProviders: ExchangeProviderStatus[];
  racingAutopilot: RacingAutopilotNotice[];
  settings: AppSettings;
  balances: BalanceSummary;
  offers: OfferSummary[];
}
