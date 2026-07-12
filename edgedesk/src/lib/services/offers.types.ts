/**
 * Client-safe offer types (no SQLite / server services).
 */
import type { OfferRow } from "@/lib/db/schema";
import type { EvBasis } from "@/lib/offers/advantage";

export type FreeBetStage =
  | "none"
  | "awaiting_result"
  | "not_awarded"
  | "awarded"
  | "in_use"
  | "settled";

export interface OfferProfitBreakdown {
  qualifyingProfit: number;
  qualifyingSettledCount: number;
  qualifyingOpenCount: number;
  freeBetAwarded: boolean;
  freeBetAwardAmount: number | null;
  freeBetAwardReason: string | null;
  freeBetStage: FreeBetStage;
  freeBetProfit: number;
  freeBetOpenCount: number;
  freeBetSettledCount: number;
  openExpectedProfit: number;
  totalProfit: number;
}

export type OfferRecurrenceFreq = "daily" | "weekly";

export interface OfferRecurrenceRule {
  freq: OfferRecurrenceFreq;
  interval: number;
  byWeekday?: number[];
}

export interface OfferRecurrenceMeta {
  seriesId: number;
  enabled: boolean;
  rule: OfferRecurrenceRule;
  instanceDate: string | null;
  stoppedFrom: string | null;
}

export interface EvLockSummary {
  expectedProfit: number;
  basis: EvBasis;
  version: number;
  /** null until settled */
  capturePct: number | null;
  /** null until settled */
  realizedProfit: number | null;
  lockedAt: number;
}

export interface OfferSummary extends OfferRow {
  betCount: number;
  openBets: number;
  actualProfit: number;
  expectedFromBets: number;
  profit: OfferProfitBreakdown;
  recurrence?: OfferRecurrenceMeta | null;
  /** Immutable EV baseline; populated once the campaign goes active. */
  evLock?: EvLockSummary | null;
}
