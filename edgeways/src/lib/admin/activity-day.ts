import { formatFixtureStepperLabel } from "@/lib/events/fixture-day-groups";
import { ukDateTimeToUtcMs } from "@/lib/offers/offer-expiry";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ActivityDayRange = {
  start: number;
  endExclusive: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Europe/London calendar day as YYYY-MM-DD. */
export function londonYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isActivityYmd(value: string | null | undefined): value is string {
  if (!value || !YMD.test(value)) return false;
  const [, year, month, day] = value.match(YMD)!;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function shiftActivityYmd(ymd: string, days: number): string {
  if (!isActivityYmd(ymd) || !Number.isFinite(days)) return ymd;
  const [, year, month, day] = ymd.match(YMD)!;
  const dt = new Date(Number(year), Number(month) - 1, Number(day) + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** True when `ymd` is after today's London calendar day. */
export function isFutureActivityDay(ymd: string, now = new Date()): boolean {
  return isActivityYmd(ymd) && ymd > londonYmd(now);
}

/** Invalid or future days fall back to today (London). */
export function resolveActivityMixDay(
  raw: string | null | undefined,
  now = new Date()
): string {
  const today = londonYmd(now);
  if (!isActivityYmd(raw) || raw > today) return today;
  return raw;
}

export function activityDayLabel(ymd: string, now = new Date()): string {
  if (!isActivityYmd(ymd)) return "Today";
  return formatFixtureStepperLabel(ymd, now.getTime(), "Europe/London");
}

export function londonDayRangeMs(ymd: string): ActivityDayRange | null {
  if (!isActivityYmd(ymd)) return null;
  const start = ukDateTimeToUtcMs(ymd, 0, 0);
  const endExclusive = ukDateTimeToUtcMs(shiftActivityYmd(ymd, 1), 0, 0);
  if (start == null || endExclusive == null) return null;
  return { start, endExclusive };
}
