/**
 * App-wide user preferences - stored as key/value in SQLite (server-only).
 * Client-safe types/helpers: `./settings-shared`.
 */
import { eq } from "drizzle-orm";
import { db, appSettings } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  bookmakerFromOfferPrefs,
  normalizeMobileDeckPin,
  stakeFromOfferPrefs,
  type AppSettings,
  type OfferBetPref,
} from "./settings-shared";
import { normalizeDisplayTimezone } from "@/lib/display-timezone";
import { normalizeTimeFormat, setDisplayTimeFormat } from "@/lib/time-format";

export type { AppSettings, OfferBetPref };
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
    alertsRaceOffSoon: readRaw("alertsRaceOffSoon") !== "false",
    alertsResultSettled: readRaw("alertsResultSettled") !== "false",
    alertsNakedExposure: readRaw("alertsNakedExposure") !== "false",
    alertsTwoUpLock: readRaw("alertsTwoUpLock") !== "false",
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

export type AppSettingsPatch = Partial<AppSettings> & {
  /** Merge a single offer pref without replacing the whole map. */
  offerBetPref?: { offerId: number; stake: number; bookmaker?: string };
};

export function patchAppSettings(patch: AppSettingsPatch): AppSettings {
  if (patch.defaultBackStake != null) writeRaw("defaultBackStake", String(patch.defaultBackStake));
  if (patch.defaultBetType != null) writeRaw("defaultBetType", patch.defaultBetType);
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
  return getAppSettings();
}
