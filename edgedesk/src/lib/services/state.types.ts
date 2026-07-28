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

export interface LivePosition {
  betId: number;
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
  settledProfit: number;
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
  /** True when this process opened the demo database (G2 watermark) */
  demoMode: boolean;
  livePositions: LivePosition[];
  liveEventModels: LiveEventModel[];
  /** Cumulative retained P&L; commissionPaid is cumulative exchange commission, so gross = value + commissionPaid. */
  series: { time: number; value: number; commissionPaid: number }[];
  /** P&L-affecting balance adjustments (chart markers alongside settled bets). */
  pnlAdjustments: { id: number; time: number; amount: number; detail: string | null }[];
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
