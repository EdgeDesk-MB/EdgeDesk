/**
 * Client-safe offer types (no SQLite / server services).
 */
import type { OfferRow, UserReminderRow } from "@/lib/db/schema";
import type { EvBasis } from "@/lib/offers/advantage";
import type { OfferDeskProgress } from "@/lib/offers/offer-desk-progress";

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

export type OfferRecurrenceFreq = "daily" | "weekly" | "monthly";

export interface OfferRecurrenceRule {
  freq: OfferRecurrenceFreq;
  interval: number;
  byWeekday?: number[];
  /** Monthly only: day of month 1-31 (clamped to the month's last day when shorter). */
  byMonthday?: number;
  /** Days after each occurrence's date that it expires; 0/undefined = same calendar day. */
  expiryOffsetDays?: number;
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
  /** B7 mistake tag on the settled snapshot, null = untagged */
  mistakeTag: string | null;
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
  /** Pending user reminders linked to this campaign (not yet fired/cancelled) */
  reminders?: UserReminderRow[];
  /** Earliest startTime of an open linked bet, when the event is known. */
  awaitingEventAt?: number | null;
  /** Linked Acca / Bet Builder / Systems run still in play, when one exists. */
  deskProgress?: OfferDeskProgress | null;
}
