/**
 * Client-safe settings types + pure helpers (no SQLite / Node APIs).
 * Server persistence lives in `settings.ts`.
 */

import { DEFAULT_TIME_FORMAT, type TimeFormatPreference } from "@/lib/time-format";
import { DEFAULT_HOME_LAYOUT, type HomeLayoutSettings } from "@/lib/ui/home-layout";
import type { PlanPreview } from "@/lib/entitlements/acca-desk";
import { isKnownSport, type SportValue } from "@/lib/sports";

export { normalizeHomeLayout, type HomeLayoutSettings } from "@/lib/ui/home-layout";

export type { PlanPreview };

export function normalizePlanPreview(value: string | null | undefined): PlanPreview {
  if (value === "free" || value === "core" || value === "edge" || value === "unlocked") {
    return value;
  }
  return "unlocked";
}

/** Stored as a stringified ms epoch; anything unparseable means unconfirmed. */
export function normalizeAgeConfirmedAt(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export interface OfferBetPref {
  stake: number;
  bookmaker: string;
}

export interface AppSettings {
  defaultBackStake: number;
  defaultBetType: "qualifying" | "free_snr" | "free_sr" | "risk_free";
  /** Pre-fill Add bet sport when opened from the nav. */
  defaultSport: SportValue;
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
  /** Alert toggles (C4) - local notifications, toast fallback. */
  alertsOfferExpiring: boolean;
  alertsRaceOffSoon: boolean;
  alertsResultSettled: boolean;
  alertsNakedExposure: boolean;
  alertsTwoUpLock: boolean;
  /** Weekly digest (H1) - Monday morning summary of last week; opt-in. */
  digestWeekly: boolean;
  /** Tunable behaviour thresholds (E1) - see TuningSettings */
  tuning: TuningSettings;
  /** Home widget order and visibility (E2) */
  homeLayout: HomeLayoutSettings;
  /** Monthly profit target in £ (G1); null = no target, no pace copy */
  monthlyProfitTarget: number | null;
  /** Brand accent preset id (amber, viridian, …, custom). */
  brandAccentPreset: string;
  /** Brand accent hex (#RRGGBB); used with custom or as resolved colour. */
  brandAccentHex: string;
  /** UI typeface id (`default` = Noto Sans, `figtree`, …). */
  uiFont: string;
  /** Top bar Hero Pattern id (`diagonal-lines`, …). */
  headerPattern: string;
  /**
   * Preview entitlement tier until N0 billing. Default unlocked = full desk access.
   * `free` blocks Acca Desk offer routing (falls back to Add bet).
   */
  planPreview: PlanPreview;
  /** ms epoch when the user confirmed they are 18+ (EDGE-13); null = not yet. */
  ageConfirmedAt: number | null;
}

/**
 * Tunable behaviour thresholds (E1). Every default exactly reproduces the
 * previously hardcoded behaviour, so an untouched Settings page is a
 * zero-diff upgrade.
 */
export interface TuningSettings {
  /** Grace period (minutes) before a naked back alerts */
  nakedExposureMinutes: number;
  /** Tightened grace (minutes) when the event starts within the hour / in play */
  nakedImminentMinutes: number;
  /** Offer drought (days) before the "mark as cooling?" nudge */
  droughtNudgeDays: number;
  /** Bayesian prior for free-bet retention (0–1) */
  retentionPrior: number;
  /** Pseudo-conversions behind the retention prior */
  retentionPriorWeight: number;
  /** Capture below this (0–1) prompts a mistake tag on settled campaigns */
  mistakeCapturePct: number;
  /** Settled campaigns needed before the Edge Report renders */
  edgeReportMinCampaigns: number;
  /** Sparse overrides for do-next EFFORT_MINUTES; empty = built-ins */
  effortMinutes: Record<string, number>;
}

export const DEFAULT_TUNING: TuningSettings = {
  nakedExposureMinutes: 10,
  nakedImminentMinutes: 3,
  droughtNudgeDays: 40,
  retentionPrior: 0.8,
  retentionPriorWeight: 5,
  mistakeCapturePct: 0.9,
  edgeReportMinCampaigns: 5,
  effortMinutes: {},
};

function clamped(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** The only path into storage - clamps every field, drops unknown keys. */
export function normalizeTuning(raw: unknown): TuningSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const effort: Record<string, number> = {};
  if (r.effortMinutes && typeof r.effortMinutes === "object" && !Array.isArray(r.effortMinutes)) {
    for (const [kind, v] of Object.entries(r.effortMinutes as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
      if (Number.isFinite(n) && n > 0 && n <= 480) effort[kind] = n;
    }
  }
  return {
    nakedExposureMinutes: clamped(r.nakedExposureMinutes, 1, 1440, DEFAULT_TUNING.nakedExposureMinutes),
    nakedImminentMinutes: clamped(r.nakedImminentMinutes, 0, 1440, DEFAULT_TUNING.nakedImminentMinutes),
    droughtNudgeDays: clamped(r.droughtNudgeDays, 1, 365, DEFAULT_TUNING.droughtNudgeDays),
    retentionPrior: clamped(r.retentionPrior, 0, 1, DEFAULT_TUNING.retentionPrior),
    retentionPriorWeight: clamped(r.retentionPriorWeight, 0, 100, DEFAULT_TUNING.retentionPriorWeight),
    mistakeCapturePct: clamped(r.mistakeCapturePct, 0, 1, DEFAULT_TUNING.mistakeCapturePct),
    edgeReportMinCampaigns: Math.round(
      clamped(r.edgeReportMinCampaigns, 1, 100, DEFAULT_TUNING.edgeReportMinCampaigns)
    ),
    effortMinutes: effort,
  };
}

export const MOBILE_DECK_PINS = ["auto", "hero", "plan", "chart", "feed", "do-next"] as const;
export type MobileDeckPin = (typeof MOBILE_DECK_PINS)[number];

export function normalizeMobileDeckPin(value: string | null | undefined): MobileDeckPin {
  return (MOBILE_DECK_PINS as readonly string[]).includes(value ?? "")
    ? (value as MobileDeckPin)
    : "auto";
}

export function normalizeDefaultSport(value: string | null | undefined): SportValue {
  return isKnownSport(value) ? value : "football";
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultBackStake: 10,
  defaultBetType: "qualifying",
  defaultSport: "football",
  defaultBookmaker: "",
  offerRemindersEnabled: true,
  /** Horizon days for the morning "Your tasks today" digest (Do Next expiry filter). */
  offerReminderDays: [3, 1],
  offerBetPrefs: {},
  ocrAutoMatchEvents: true,
  dashboardPollMs: 3000,
  displayTimezone: "Europe/London",
  timeFormat: DEFAULT_TIME_FORMAT,
  mobileDeckPin: "auto",
  alertsOfferExpiring: true,
  alertsRaceOffSoon: true,
  alertsResultSettled: true,
  alertsNakedExposure: true,
  alertsTwoUpLock: true,
  digestWeekly: false,
  tuning: DEFAULT_TUNING,
  homeLayout: DEFAULT_HOME_LAYOUT,
  monthlyProfitTarget: null,
  brandAccentPreset: "amber",
  brandAccentHex: "#FFC71E",
  uiFont: "default",
  headerPattern: "diagonal-lines",
  planPreview: "unlocked",
  ageConfirmedAt: null,
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
