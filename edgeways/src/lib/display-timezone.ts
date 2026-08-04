/** User-facing timezone for fixture kickoffs and event times. */

export const DEFAULT_DISPLAY_TIMEZONE = "Europe/London";

export const DISPLAY_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Dublin", label: "Dublin" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Rome", label: "Rome" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Europe/Lisbon", label: "Lisbon" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Chicago", label: "Chicago" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "UTC", label: "UTC" },
];

export function isValidDisplayTimezone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function normalizeDisplayTimezone(timeZone?: string | null): string {
  const tz = timeZone?.trim();
  if (tz && isValidDisplayTimezone(tz)) return tz;
  const known = DISPLAY_TIMEZONE_OPTIONS.find((o) => o.value === tz);
  if (known) return known.value;
  return DEFAULT_DISPLAY_TIMEZONE;
}

export function displayTimezoneLabel(timeZone: string): string {
  return (
    DISPLAY_TIMEZONE_OPTIONS.find((o) => o.value === timeZone)?.label ??
    timeZone.replace(/_/g, " ")
  );
}
