/**
 * Client-safe app state types (no SQLite / server services).
 */
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
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

export interface AppState {
  events: EventRow[];
  bets: BetRow[];
  settledProfit: number;
  provisionalProfit: number;
  livePositions: LivePosition[];
  liveEventModels: LiveEventModel[];
  series: { time: number; value: number }[];
  history: HistoryRow[];
  chartHistory: HistoryRow[];
  promoAwards: Record<number, { amount: number; reason: string }>;
  apiConfigured: boolean;
  racingApiConfigured: boolean;
  racingResultsTier: RacingResultsTier;
  apiUsage: { used: number; budget: number };
  racingApiUsage: { used: number; budget: number };
  exchangeProvider: string;
  exchangeName: string;
  exchangeStatus: ExchangeProviderStatus;
  exchangeProviders: ExchangeProviderStatus[];
  racingAutopilot: RacingAutopilotNotice[];
  settings: AppSettings;
  balances: BalanceSummary;
  offers: OfferSummary[];
}
