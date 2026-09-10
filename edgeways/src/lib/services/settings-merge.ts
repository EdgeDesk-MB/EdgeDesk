/**
 * Pure settings parse + patch. Used by SQLite writes and the hosted Neon blob.
 */
import {
  DEFAULT_BRAND_ACCENT_HEX,
  DEFAULT_BRAND_ACCENT_PRESET,
  hexForPreset,
  isBrandAccentPresetId,
  normalizeHex,
} from "@/lib/brand-accent";
import { normalizeDisplayTimezone } from "@/lib/display-timezone";
import { normalizeHeaderPattern } from "@/lib/header-pattern";
import { normalizeTimeFormat } from "@/lib/time-format";
import { normalizeUiFont } from "@/lib/ui-font";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TUNING,
  normalizeAgeConfirmedAt,
  normalizeDefaultSport,
  normalizeHomeLayout,
  normalizeMobileDeckPin,
  normalizePlanPreview,
  normalizeTuning,
  type AppSettings,
  type FixtureBoardViewSettings,
  type HomeLayoutSettings,
  type OfferBetPref,
  type TuningSettings,
} from "@/lib/services/settings-shared";
import {
  mergeFixtureBoardView,
  normalizeFixtureBoardView,
} from "@/lib/events/fixture-board-view";
import { normalizeFavouriteScopeIds } from "@/lib/events/fixture-scope";

export type AppSettingsPatch = Partial<
  Omit<
    AppSettings,
    "tuning" | "homeLayout" | "fixtureBoardView" | "billing" | "twoupScoutPreview"
  >
> & {
  /** Merge a single offer pref without replacing the whole map. */
  offerBetPref?: { offerId: number; stake: number; bookmaker?: string };
  /** Partial merge into the tuning object; each field clamped on write. */
  tuning?: Partial<TuningSettings>;
  /** Partial merge into the Home layout; normalised on write. */
  homeLayout?: Partial<HomeLayoutSettings>;
  /** Partial merge into the Fixtures tape view; normalised on write. */
  fixtureBoardView?: Partial<FixtureBoardViewSettings>;
};

const FIXTURE_SCOPE_SETTING_KEYS = [
  "favouriteFootballScopes",
  "favouriteRacingCourses",
  "hiddenFootballScopes",
  "hiddenRacingCourses",
  "fixtureBoardView",
] as const;

/** Hide / saved patches only. Skip billing and a full desk refresh. */
export function isFixtureScopeSettingsPatch(patch: AppSettingsPatch): boolean {
  const keys = (Object.keys(patch) as (keyof AppSettingsPatch)[]).filter(
    (key) => patch[key] !== undefined
  );
  return (
    keys.length > 0 &&
    keys.every((key) =>
      (FIXTURE_SCOPE_SETTING_KEYS as readonly string[]).includes(key as string)
    )
  );
}

function cloneSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    offerReminderDays: [...settings.offerReminderDays],
    offerBetPrefs: { ...settings.offerBetPrefs },
    tuning: {
      ...settings.tuning,
      effortMinutes: { ...settings.tuning.effortMinutes },
    },
    homeLayout: {
      deckOrder: [...settings.homeLayout.deckOrder],
      deckHidden: [...settings.homeLayout.deckHidden],
      desktopHidden: [...settings.homeLayout.desktopHidden],
    },
    favouriteFootballScopes: [...(settings.favouriteFootballScopes ?? [])],
    favouriteRacingCourses: [...(settings.favouriteRacingCourses ?? [])],
    hiddenFootballScopes: [...(settings.hiddenFootballScopes ?? [])],
    hiddenRacingCourses: [...(settings.hiddenRacingCourses ?? [])],
    fixtureBoardView: normalizeFixtureBoardView(settings.fixtureBoardView),
  };
}

function parseOfferBetPrefs(raw: unknown): Record<string, OfferBetPref> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, OfferBetPref> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const stake = typeof row.stake === "number" ? row.stake : parseFloat(String(row.stake ?? ""));
    const bookmaker = typeof row.bookmaker === "string" ? row.bookmaker.trim() : "";
    if (!Number.isFinite(stake) || stake <= 0) continue;
    out[key] = { stake, bookmaker };
  }
  return out;
}

function parseMonthlyTarget(raw: unknown): number | null {
  if (raw == null || raw === "null") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 && n <= 1_000_000 ? n : null;
}

function parseBetType(raw: unknown): AppSettings["defaultBetType"] {
  return raw === "qualifying" ||
    raw === "free_snr" ||
    raw === "free_sr" ||
    raw === "risk_free"
    ? raw
    : DEFAULT_SETTINGS.defaultBetType;
}

function parseReminderDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SETTINGS.offerReminderDays];
  const days = raw.filter((d): d is number => typeof d === "number" && Number.isFinite(d));
  return days.length > 0 ? days : [...DEFAULT_SETTINGS.offerReminderDays];
}

function parsePollMs(raw: unknown): number {
  const poll = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isFinite(poll) && poll >= 1000 && poll <= 60_000
    ? poll
    : DEFAULT_SETTINGS.dashboardPollMs;
}

function parseStake(raw: unknown): number {
  const stake = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(stake) && stake > 0 ? stake : DEFAULT_SETTINGS.defaultBackStake;
}

function parseAgeConfirmedAt(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  }
  return normalizeAgeConfirmedAt(String(raw));
}

function parseBrand(raw: Record<string, unknown>): Pick<
  AppSettings,
  "brandAccentPreset" | "brandAccentHex"
> {
  const presetRaw =
    typeof raw.brandAccentPreset === "string" ? raw.brandAccentPreset : undefined;
  const presetId = isBrandAccentPresetId(presetRaw)
    ? presetRaw
    : DEFAULT_BRAND_ACCENT_PRESET;
  const hex =
    normalizeHex(typeof raw.brandAccentHex === "string" ? raw.brandAccentHex : null) ??
    hexForPreset(presetId) ??
    DEFAULT_BRAND_ACCENT_HEX;
  return {
    brandAccentPreset: presetId,
    brandAccentHex: hexForPreset(presetId, hex),
  };
}

/** Rebuild settings from a hosted JSON blob. Unknown or empty input → defaults. */
export function parseStoredSettings(raw: unknown): AppSettings {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return cloneSettings(DEFAULT_SETTINGS);
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return cloneSettings(DEFAULT_SETTINGS);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return cloneSettings(DEFAULT_SETTINGS);
  }
  const o = parsed as Record<string, unknown>;
  const brand = parseBrand(o);
  return {
    defaultBackStake: parseStake(o.defaultBackStake),
    defaultBetType: parseBetType(o.defaultBetType),
    defaultSport: normalizeDefaultSport(
      typeof o.defaultSport === "string" ? o.defaultSport : undefined
    ),
    defaultBookmaker:
      typeof o.defaultBookmaker === "string"
        ? o.defaultBookmaker
        : DEFAULT_SETTINGS.defaultBookmaker,
    offerRemindersEnabled: o.offerRemindersEnabled !== false,
    offerReminderDays: parseReminderDays(o.offerReminderDays),
    offerBetPrefs: parseOfferBetPrefs(o.offerBetPrefs),
    ocrAutoMatchEvents: o.ocrAutoMatchEvents !== false,
    dashboardPollMs: parsePollMs(o.dashboardPollMs),
    displayTimezone: normalizeDisplayTimezone(
      typeof o.displayTimezone === "string" ? o.displayTimezone : undefined
    ),
    timeFormat: normalizeTimeFormat(
      typeof o.timeFormat === "string" ? o.timeFormat : undefined
    ),
    mobileDeckPin: normalizeMobileDeckPin(
      typeof o.mobileDeckPin === "string" ? o.mobileDeckPin : undefined
    ),
    alertsOfferExpiring: o.alertsOfferExpiring !== false,
    alertsFreeBetExpiring: o.alertsFreeBetExpiring !== false,
    alertsRaceOffSoon: o.alertsRaceOffSoon !== false,
    alertsResultSettled: o.alertsResultSettled !== false,
    alertsNakedExposure: o.alertsNakedExposure !== false,
    alertsTwoUpLock: o.alertsTwoUpLock !== false,
    digestWeekly: o.digestWeekly === true,
    digestLastSentWeek:
      typeof o.digestLastSentWeek === "string" && o.digestLastSentWeek.trim()
        ? o.digestLastSentWeek.trim()
        : null,
    dailyTasksLastSentDay:
      typeof o.dailyTasksLastSentDay === "string" && o.dailyTasksLastSentDay.trim()
        ? o.dailyTasksLastSentDay.trim()
        : null,
    tuning: normalizeTuning(o.tuning ?? DEFAULT_TUNING),
    homeLayout: normalizeHomeLayout(o.homeLayout),
    monthlyProfitTarget: parseMonthlyTarget(o.monthlyProfitTarget),
    favouriteFootballScopes: normalizeFavouriteScopeIds(o.favouriteFootballScopes),
    favouriteRacingCourses: normalizeFavouriteScopeIds(o.favouriteRacingCourses),
    hiddenFootballScopes: normalizeFavouriteScopeIds(o.hiddenFootballScopes),
    hiddenRacingCourses: normalizeFavouriteScopeIds(o.hiddenRacingCourses),
    fixtureBoardView: normalizeFixtureBoardView(o.fixtureBoardView),
    ...brand,
    uiFont: normalizeUiFont(typeof o.uiFont === "string" ? o.uiFont : undefined),
    headerPattern: normalizeHeaderPattern(
      typeof o.headerPattern === "string" ? o.headerPattern : undefined
    ),
    planPreview: normalizePlanPreview(
      typeof o.planPreview === "string" ? o.planPreview : undefined
    ),
    ageConfirmedAt: parseAgeConfirmedAt(o.ageConfirmedAt),
  };
}

export function mergeAppSettings(
  current: AppSettings,
  patch: AppSettingsPatch
): AppSettings {
  const next = cloneSettings(current);

  if (patch.defaultBackStake != null) next.defaultBackStake = parseStake(patch.defaultBackStake);
  if (patch.defaultBetType != null) next.defaultBetType = parseBetType(patch.defaultBetType);
  if (patch.defaultSport != null) next.defaultSport = normalizeDefaultSport(patch.defaultSport);
  if (patch.defaultBookmaker != null) next.defaultBookmaker = patch.defaultBookmaker;
  if (patch.offerRemindersEnabled != null) {
    next.offerRemindersEnabled = patch.offerRemindersEnabled;
  }
  if (patch.offerReminderDays != null) {
    next.offerReminderDays = parseReminderDays(patch.offerReminderDays);
  }
  if (patch.offerBetPrefs != null) {
    next.offerBetPrefs = parseOfferBetPrefs(patch.offerBetPrefs);
  }
  if (patch.offerBetPref != null) {
    const { offerId, stake, bookmaker } = patch.offerBetPref;
    if (Number.isFinite(offerId) && offerId > 0 && Number.isFinite(stake) && stake > 0) {
      next.offerBetPrefs[String(offerId)] = {
        stake,
        bookmaker: (bookmaker ?? next.offerBetPrefs[String(offerId)]?.bookmaker ?? "").trim(),
      };
    }
  }
  if (patch.ocrAutoMatchEvents != null) next.ocrAutoMatchEvents = patch.ocrAutoMatchEvents;
  if (patch.dashboardPollMs != null) next.dashboardPollMs = parsePollMs(patch.dashboardPollMs);
  if (patch.displayTimezone != null) {
    next.displayTimezone = normalizeDisplayTimezone(patch.displayTimezone);
  }
  if (patch.timeFormat != null) next.timeFormat = normalizeTimeFormat(patch.timeFormat);
  if (patch.mobileDeckPin != null) {
    next.mobileDeckPin = normalizeMobileDeckPin(patch.mobileDeckPin);
  }
  if (patch.alertsOfferExpiring != null) next.alertsOfferExpiring = patch.alertsOfferExpiring;
  if (patch.alertsFreeBetExpiring != null) {
    next.alertsFreeBetExpiring = patch.alertsFreeBetExpiring;
  }
  if (patch.alertsRaceOffSoon != null) next.alertsRaceOffSoon = patch.alertsRaceOffSoon;
  if (patch.alertsResultSettled != null) next.alertsResultSettled = patch.alertsResultSettled;
  if (patch.alertsNakedExposure != null) next.alertsNakedExposure = patch.alertsNakedExposure;
  if (patch.alertsTwoUpLock != null) next.alertsTwoUpLock = patch.alertsTwoUpLock;
  if (patch.digestWeekly != null) next.digestWeekly = patch.digestWeekly;
  if (patch.digestLastSentWeek !== undefined) {
    next.digestLastSentWeek =
      typeof patch.digestLastSentWeek === "string" && patch.digestLastSentWeek.trim()
        ? patch.digestLastSentWeek.trim()
        : null;
  }
  if (patch.dailyTasksLastSentDay !== undefined) {
    next.dailyTasksLastSentDay =
      typeof patch.dailyTasksLastSentDay === "string" && patch.dailyTasksLastSentDay.trim()
        ? patch.dailyTasksLastSentDay.trim()
        : null;
  }
  if (patch.tuning != null) {
    next.tuning = normalizeTuning({ ...next.tuning, ...patch.tuning });
  }
  if (patch.homeLayout != null) {
    next.homeLayout = normalizeHomeLayout({
      ...next.homeLayout,
      ...patch.homeLayout,
    });
  }
  if (patch.monthlyProfitTarget !== undefined) {
    next.monthlyProfitTarget = parseMonthlyTarget(patch.monthlyProfitTarget);
  }
  if (patch.favouriteFootballScopes != null) {
    next.favouriteFootballScopes = normalizeFavouriteScopeIds(patch.favouriteFootballScopes);
  }
  if (patch.favouriteRacingCourses != null) {
    next.favouriteRacingCourses = normalizeFavouriteScopeIds(patch.favouriteRacingCourses);
  }
  if (patch.hiddenFootballScopes != null) {
    next.hiddenFootballScopes = normalizeFavouriteScopeIds(patch.hiddenFootballScopes);
  }
  if (patch.hiddenRacingCourses != null) {
    next.hiddenRacingCourses = normalizeFavouriteScopeIds(patch.hiddenRacingCourses);
  }
  if (patch.fixtureBoardView != null) {
    next.fixtureBoardView = mergeFixtureBoardView(next.fixtureBoardView, patch.fixtureBoardView);
  }
  if (patch.brandAccentPreset != null) {
    const id = isBrandAccentPresetId(patch.brandAccentPreset)
      ? patch.brandAccentPreset
      : DEFAULT_BRAND_ACCENT_PRESET;
    next.brandAccentPreset = id;
    next.brandAccentHex = hexForPreset(id, next.brandAccentHex);
  }
  if (patch.brandAccentHex != null) {
    next.brandAccentHex = normalizeHex(patch.brandAccentHex) ?? DEFAULT_BRAND_ACCENT_HEX;
  }
  if (patch.uiFont != null) next.uiFont = normalizeUiFont(patch.uiFont);
  if (patch.headerPattern != null) {
    next.headerPattern = normalizeHeaderPattern(patch.headerPattern);
  }
  if (patch.planPreview != null) next.planPreview = normalizePlanPreview(patch.planPreview);
  if (patch.ageConfirmedAt !== undefined) {
    next.ageConfirmedAt = parseAgeConfirmedAt(patch.ageConfirmedAt);
  }

  return next;
}
