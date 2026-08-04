/**
 * User-facing clock format - the single source for rendering times of day.
 * The preference lives in Settings (default 24-hour). Storage, form inputs
 * and URL fragments always stay 24h HH:mm regardless of the preference.
 */

export type TimeFormatPreference = "24h" | "12h";

export const DEFAULT_TIME_FORMAT: TimeFormatPreference = "24h";

export const TIME_FORMAT_OPTIONS: { value: TimeFormatPreference; label: string }[] = [
  { value: "24h", label: "24-hour (17:30)" },
  { value: "12h", label: "12-hour (5:30 pm)" },
];

export function normalizeTimeFormat(value?: string | null): TimeFormatPreference {
  return value === "12h" ? "12h" : DEFAULT_TIME_FORMAT;
}

/**
 * Process-wide current preference, so pure display helpers don't need the
 * setting threaded through every call chain. Synced from settings by
 * AppStateProvider (client) and getAppSettings (server).
 */
let currentTimeFormat: TimeFormatPreference = DEFAULT_TIME_FORMAT;

export function setDisplayTimeFormat(value?: string | null): void {
  currentTimeFormat = normalizeTimeFormat(value);
}

export function getDisplayTimeFormat(): TimeFormatPreference {
  return currentTimeFormat;
}

export interface FormatClockTimeOptions {
  timeZone?: string;
  withSeconds?: boolean;
  /** Override the active preference (tests, previews). */
  format?: TimeFormatPreference;
}

/** "17:30" or "5:30 pm" for an epoch/Date in the active format. */
export function formatClockTime(
  input: number | Date,
  opts: FormatClockTimeOptions = {}
): string {
  const d = typeof input === "number" ? new Date(input) : input;
  const format = opts.format ?? currentTimeFormat;
  const options: Intl.DateTimeFormatOptions =
    format === "12h"
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : { hour: "2-digit", minute: "2-digit", hour12: false };
  if (opts.withSeconds) options.second = "2-digit";
  if (opts.timeZone) options.timeZone = opts.timeZone;
  return new Intl.DateTimeFormat("en-GB", options).format(d);
}

/** Re-render a stored/parsed 24h "HH:mm" string in the active format. */
export function formatClockString(
  hhmm: string,
  format: TimeFormatPreference = currentTimeFormat
): string {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const hours = Number(m[1]);
  const minutes = m[2];
  if (hours > 23 || Number(minutes) > 59) return hhmm;
  if (format === "24h") return `${String(hours).padStart(2, "0")}:${minutes}`;
  const suffix = hours < 12 ? "am" : "pm";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${minutes} ${suffix}`;
}
