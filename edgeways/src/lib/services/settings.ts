/**
 * App-wide user preferences - stored as key/value in SQLite (server-only).
 * Client-safe types/helpers: `./settings-shared`.
 */
import { eq } from "drizzle-orm";
import { db, appSettings } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  bookmakerFromOfferPrefs,
  normalizeDefaultSport,
  normalizeHomeLayout,
  normalizeMobileDeckPin,
  normalizePlanPreview,
  normalizeAgeConfirmedAt,
  normalizeTuning,
  stakeFromOfferPrefs,
  type AppSettings,
  type HomeLayoutSettings,
  type OfferBetPref,
  type TuningSettings,
} from "./settings-shared";
import {
  DEFAULT_BRAND_ACCENT_HEX,
  DEFAULT_BRAND_ACCENT_PRESET,
  hexForPreset,
  isBrandAccentPresetId,
  normalizeHex,
} from "@/lib/brand-accent";
import { normalizeDisplayTimezone } from "@/lib/display-timezone";
import { normalizeTimeFormat, setDisplayTimeFormat } from "@/lib/time-format";
import { normalizeUiFont } from "@/lib/ui-font";
import { normalizeHeaderPattern } from "@/lib/header-pattern";
import type { AppSettingsPatch } from "./settings-merge";

export type { AppSettings, OfferBetPref };
export type { AppSettingsPatch } from "./settings-merge";
export {
  DEFAULT_SETTINGS,
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
} from "./settings-shared";

function readRaw(key: string): string | undefined {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function writeRaw(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) {
    db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
  } else {
    db.insert(appSettings).values({ key, value }).run();
  }
}

function parseOfferBetPrefs(raw: string | undefined): Record<string, OfferBetPref> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, OfferBetPref> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const stake = typeof row.stake === "number" ? row.stake : parseFloat(String(row.stake ?? ""));
      const bookmaker = typeof row.bookmaker === "string" ? row.bookmaker.trim() : "";
      if (!Number.isFinite(stake) || stake <= 0) continue;
      out[key] = { stake, bookmaker };
    }
    return out;
  } catch {
    return {};
  }
}

function parseTuning(raw: string | undefined): TuningSettings {
  if (!raw) return normalizeTuning(undefined);
  try {
    return normalizeTuning(JSON.parse(raw));
  } catch {
    return normalizeTuning(undefined);
  }
}

function parseMonthlyTarget(raw: string | undefined): number | null {
  if (!raw || raw === "null") return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : null;
}

function parseHomeLayout(raw: string | undefined): HomeLayoutSettings {
  if (!raw) return normalizeHomeLayout(undefined);
  try {
    return normalizeHomeLayout(JSON.parse(raw));
  } catch {
    return normalizeHomeLayout(undefined);
  }
}

export function getAppSettings(): AppSettings {
  const stake = parseFloat(readRaw("defaultBackStake") ?? "");
  const poll = parseInt(readRaw("dashboardPollMs") ?? "", 10);
  let reminderDays = DEFAULT_SETTINGS.offerReminderDays;
  try {
    const parsed = JSON.parse(readRaw("offerReminderDays") ?? "[]") as number[];
    if (Array.isArray(parsed) && parsed.length > 0) reminderDays = parsed;
  } catch {
    /* keep default */
  }

  const betType = readRaw("defaultBetType");
  const validBetType =
    betType === "qualifying" ||
    betType === "free_snr" ||
    betType === "free_sr" ||
    betType === "risk_free"
      ? betType
      : DEFAULT_SETTINGS.defaultBetType;

  const settings: AppSettings = {
    defaultBackStake: Number.isFinite(stake) && stake > 0 ? stake : DEFAULT_SETTINGS.defaultBackStake,
    defaultBetType: validBetType,
    defaultSport: normalizeDefaultSport(readRaw("defaultSport")),
    defaultBookmaker: readRaw("defaultBookmaker") ?? DEFAULT_SETTINGS.defaultBookmaker,
    offerRemindersEnabled: readRaw("offerRemindersEnabled") !== "false",
    offerReminderDays: reminderDays,
    offerBetPrefs: parseOfferBetPrefs(readRaw("offerBetPrefs")),
    ocrAutoMatchEvents: readRaw("ocrAutoMatchEvents") !== "false",
    dashboardPollMs:
      Number.isFinite(poll) && poll >= 1000 && poll <= 60_000
        ? poll
        : DEFAULT_SETTINGS.dashboardPollMs,
    displayTimezone: normalizeDisplayTimezone(readRaw("displayTimezone")),
    timeFormat: normalizeTimeFormat(readRaw("timeFormat")),
    mobileDeckPin: normalizeMobileDeckPin(readRaw("mobileDeckPin")),
    alertsOfferExpiring: readRaw("alertsOfferExpiring") !== "false",
    alertsFreeBetExpiring: readRaw("alertsFreeBetExpiring") !== "false",
    alertsRaceOffSoon: readRaw("alertsRaceOffSoon") !== "false",
    alertsResultSettled: readRaw("alertsResultSettled") !== "false",
    alertsNakedExposure: readRaw("alertsNakedExposure") !== "false",
    alertsTwoUpLock: readRaw("alertsTwoUpLock") !== "false",
    digestWeekly: readRaw("digestWeekly") === "true",
    digestLastSentWeek: null,
    dailyTasksLastSentDay: null,
    tuning: parseTuning(readRaw("tuning")),
    homeLayout: parseHomeLayout(readRaw("homeLayout")),
    monthlyProfitTarget: parseMonthlyTarget(readRaw("monthlyProfitTarget")),
    ...(() => {
      const rawPreset = readRaw("brandAccentPreset");
      const presetId = isBrandAccentPresetId(rawPreset)
        ? rawPreset
        : DEFAULT_BRAND_ACCENT_PRESET;
      const hex =
        normalizeHex(readRaw("brandAccentHex")) ??
        hexForPreset(presetId) ??
        DEFAULT_BRAND_ACCENT_HEX;
      return {
        brandAccentPreset: presetId,
        brandAccentHex: hexForPreset(presetId, hex),
      };
    })(),
    uiFont: normalizeUiFont(readRaw("uiFont")),
    headerPattern: normalizeHeaderPattern(readRaw("headerPattern")),
    planPreview: normalizePlanPreview(readRaw("planPreview")),
    ageConfirmedAt: normalizeAgeConfirmedAt(readRaw("ageConfirmedAt")),
  };
  // Server-side display helpers (history labels, sync toasts) read the
  // process-wide format; keep it in step with the persisted preference.
  setDisplayTimeFormat(settings.timeFormat);
  return settings;
}

export function getOfferBetPref(offerId: number): OfferBetPref | undefined {
  return getAppSettings().offerBetPrefs[String(offerId)];
}

/** Merge one offer's remembered stake/bookie into settings. */
export function setOfferBetPref(offerId: number, pref: OfferBetPref): AppSettings {
  if (!Number.isFinite(offerId) || offerId <= 0) return getAppSettings();
  if (!Number.isFinite(pref.stake) || pref.stake <= 0) return getAppSettings();
  const prefs = { ...getAppSettings().offerBetPrefs };
  prefs[String(offerId)] = {
    stake: pref.stake,
    bookmaker: pref.bookmaker.trim(),
  };
  writeRaw("offerBetPrefs", JSON.stringify(prefs));
  return getAppSettings();
}

/**
 * Resolve stake for an offer bet:
 * remembered pref → offer rules stake → fallback (desk / default).
 */
export function resolveOfferStake(
  offerId: number | undefined,
  rulesStake: number | null | undefined,
  fallback: number
): number {
  return stakeFromOfferPrefs(getAppSettings().offerBetPrefs, offerId, rulesStake, fallback);
}

export function resolveOfferBookmaker(
  offerId: number | undefined,
  rulesBookmaker: string | null | undefined,
  fallback = ""
): string {
  return bookmakerFromOfferPrefs(
    getAppSettings().offerBetPrefs,
    offerId,
    rulesBookmaker,
    fallback
  );
}

export function patchAppSettings(patch: AppSettingsPatch): AppSettings {
  if (patch.defaultBackStake != null) writeRaw("defaultBackStake", String(patch.defaultBackStake));
  if (patch.defaultBetType != null) writeRaw("defaultBetType", patch.defaultBetType);
  if (patch.defaultSport != null) writeRaw("defaultSport", normalizeDefaultSport(patch.defaultSport));
  if (patch.defaultBookmaker != null) writeRaw("defaultBookmaker", patch.defaultBookmaker);
  if (patch.offerRemindersEnabled != null) {
    writeRaw("offerRemindersEnabled", patch.offerRemindersEnabled ? "true" : "false");
  }
  if (patch.offerReminderDays != null) {
    writeRaw("offerReminderDays", JSON.stringify(patch.offerReminderDays));
  }
  if (patch.offerBetPrefs != null) {
    writeRaw("offerBetPrefs", JSON.stringify(patch.offerBetPrefs));
  }
  if (patch.offerBetPref != null) {
    const { offerId, stake, bookmaker } = patch.offerBetPref;
    setOfferBetPref(offerId, {
      stake,
      bookmaker: bookmaker ?? getOfferBetPref(offerId)?.bookmaker ?? "",
    });
  }
  if (patch.ocrAutoMatchEvents != null) {
    writeRaw("ocrAutoMatchEvents", patch.ocrAutoMatchEvents ? "true" : "false");
  }
  if (patch.dashboardPollMs != null) writeRaw("dashboardPollMs", String(patch.dashboardPollMs));
  if (patch.displayTimezone != null) {
    writeRaw("displayTimezone", normalizeDisplayTimezone(patch.displayTimezone));
  }
  if (patch.timeFormat != null) {
    writeRaw("timeFormat", normalizeTimeFormat(patch.timeFormat));
  }
  if (patch.mobileDeckPin != null) {
    writeRaw("mobileDeckPin", normalizeMobileDeckPin(patch.mobileDeckPin));
  }
  if (patch.alertsOfferExpiring != null) {
    writeRaw("alertsOfferExpiring", patch.alertsOfferExpiring ? "true" : "false");
  }
  if (patch.alertsFreeBetExpiring != null) {
    writeRaw("alertsFreeBetExpiring", patch.alertsFreeBetExpiring ? "true" : "false");
  }
  if (patch.alertsRaceOffSoon != null) {
    writeRaw("alertsRaceOffSoon", patch.alertsRaceOffSoon ? "true" : "false");
  }
  if (patch.alertsResultSettled != null) {
    writeRaw("alertsResultSettled", patch.alertsResultSettled ? "true" : "false");
  }
  if (patch.alertsNakedExposure != null) {
    writeRaw("alertsNakedExposure", patch.alertsNakedExposure ? "true" : "false");
  }
  if (patch.alertsTwoUpLock != null) {
    writeRaw("alertsTwoUpLock", patch.alertsTwoUpLock ? "true" : "false");
  }
  if (patch.digestWeekly != null) {
    writeRaw("digestWeekly", patch.digestWeekly ? "true" : "false");
  }
  if (patch.tuning != null) {
    const merged = normalizeTuning({ ...parseTuning(readRaw("tuning")), ...patch.tuning });
    writeRaw("tuning", JSON.stringify(merged));
  }
  if (patch.homeLayout != null) {
    const merged = normalizeHomeLayout({
      ...parseHomeLayout(readRaw("homeLayout")),
      ...patch.homeLayout,
    });
    writeRaw("homeLayout", JSON.stringify(merged));
  }
  if (patch.monthlyProfitTarget !== undefined) {
    writeRaw("monthlyProfitTarget", String(patch.monthlyProfitTarget ?? "null"));
  }
  if (patch.brandAccentPreset != null) {
    const id = isBrandAccentPresetId(patch.brandAccentPreset)
      ? patch.brandAccentPreset
      : DEFAULT_BRAND_ACCENT_PRESET;
    writeRaw("brandAccentPreset", id);
  }
  if (patch.brandAccentHex != null) {
    const hex = normalizeHex(patch.brandAccentHex) ?? DEFAULT_BRAND_ACCENT_HEX;
    writeRaw("brandAccentHex", hex);
  }
  if (patch.uiFont != null) {
    writeRaw("uiFont", normalizeUiFont(patch.uiFont));
  }
  if (patch.headerPattern != null) {
    writeRaw("headerPattern", normalizeHeaderPattern(patch.headerPattern));
  }
  if (patch.planPreview != null) {
    writeRaw("planPreview", normalizePlanPreview(patch.planPreview));
  }
  if (patch.ageConfirmedAt !== undefined) {
    writeRaw(
      "ageConfirmedAt",
      patch.ageConfirmedAt == null ? "" : String(Math.trunc(patch.ageConfirmedAt))
    );
  }
  return getAppSettings();
}
