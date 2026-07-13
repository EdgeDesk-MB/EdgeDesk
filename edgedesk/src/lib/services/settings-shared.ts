/**
 * Client-safe settings types + pure helpers (no SQLite / Node APIs).
 * Server persistence lives in `settings.ts`.
 */

import { DEFAULT_TIME_FORMAT, type TimeFormatPreference } from "@/lib/time-format";

export interface OfferBetPref {
  stake: number;
  bookmaker: string;
}

export interface AppSettings {
  defaultBackStake: number;
  defaultBetType: "qualifying" | "free_snr" | "free_sr" | "risk_free";
  defaultBookmaker: string;
  offerRemindersEnabled: boolean;
  offerReminderDays: number[];
  /** Last used stake/bookie per offer id (string keys). */
  offerBetPrefs: Record<string, OfferBetPref>;
  ocrAutoMatchEvents: boolean;
  dashboardPollMs: number;
  /** IANA timezone for fixture kickoffs and event times in the UI. */
  displayTimezone: string;
  /** Clock format for every displayed time of day (inputs stay HH:mm). */
  timeFormat: TimeFormatPreference;
  /** Mobile Home deck start card: "auto" = context-aware, else a pinned card id. */
  mobileDeckPin: MobileDeckPin;
}

export const MOBILE_DECK_PINS = ["auto", "hero", "plan", "chart", "feed", "do-next"] as const;
export type MobileDeckPin = (typeof MOBILE_DECK_PINS)[number];

export function normalizeMobileDeckPin(value: string | null | undefined): MobileDeckPin {
  return (MOBILE_DECK_PINS as readonly string[]).includes(value ?? "")
    ? (value as MobileDeckPin)
    : "auto";
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultBackStake: 10,
  defaultBetType: "qualifying",
  defaultBookmaker: "",
  offerRemindersEnabled: true,
  offerReminderDays: [7, 3, 1],
  offerBetPrefs: {},
  ocrAutoMatchEvents: true,
  dashboardPollMs: 3000,
  displayTimezone: "Europe/London",
  timeFormat: DEFAULT_TIME_FORMAT,
  mobileDeckPin: "auto",
};

/** Pure resolve - safe on client with settings from app state. */
export function stakeFromOfferPrefs(
  prefs: Record<string, OfferBetPref>,
  offerId: number | undefined,
  rulesStake: number | null | undefined,
  fallback: number
): number {
  if (offerId != null) {
    const pref = prefs[String(offerId)];
    if (pref && pref.stake > 0) return pref.stake;
  }
  if (rulesStake != null && rulesStake > 0) return rulesStake;
  return fallback > 0 ? fallback : DEFAULT_SETTINGS.defaultBackStake;
}

export function bookmakerFromOfferPrefs(
  prefs: Record<string, OfferBetPref>,
  offerId: number | undefined,
  rulesBookmaker: string | null | undefined,
  fallback = ""
): string {
  if (offerId != null) {
    const pref = prefs[String(offerId)];
    if (pref?.bookmaker) return pref.bookmaker;
  }
  return (rulesBookmaker ?? fallback).trim();
}
