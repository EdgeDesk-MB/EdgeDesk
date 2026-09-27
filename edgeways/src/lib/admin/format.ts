import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { formatClockTime } from "@/lib/time-format";

/**
 * Admin dates render on the server (UTC on Vercel) and again in the browser,
 * so they must name a timezone or hydration fails (React #418).
 */
export const ADMIN_TIME_ZONE = DEFAULT_DISPLAY_TIMEZONE;

export function formatAdminDateTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const date = new Date(ms);
  return `${formatAdminDate(ms)}, ${formatClockTime(date, { timeZone: ADMIN_TIME_ZONE })}`;
}

export function formatAdminDate(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ADMIN_TIME_ZONE,
  }).format(new Date(ms));
}
