import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/display-timezone";
import { localCalendarDate } from "@/lib/events";
import { formatOfferListGroupLabel } from "@/lib/offers/offer-list-groups";

export type FixtureDayGroup<T> = {
  dayKey: string;
  dayMs: number;
  label: string;
  items: T[];
};

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** Campaigns-style day label, using the display timezone calendar. */
export function formatFixtureListDayLabel(
  ymd: string,
  now = Date.now(),
  timeZone = DEFAULT_DISPLAY_TIMEZONE
): string {
  const today = localCalendarDate(new Date(now), timeZone);
  if (ymd === today) return "Today";
  if (ymd === shiftYmd(today, 1)) return "Tomorrow";
  if (ymd === shiftYmd(today, -1)) return "Yesterday";
  const [year, month, day] = ymd.split("-").map(Number);
  return formatOfferListGroupLabel(new Date(year, month - 1, day).getTime(), now);
}

export function groupByDisplayDay<T extends { startTime: number }>(
  items: T[],
  now = Date.now(),
  timeZone = DEFAULT_DISPLAY_TIMEZONE
): FixtureDayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = localCalendarDate(new Date(item.startTime), timeZone);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.keys()].sort().map((dayKey) => {
    const [year, month, day] = dayKey.split("-").map(Number);
    return {
      dayKey,
      dayMs: new Date(year, month - 1, day).getTime(),
      label: formatFixtureListDayLabel(dayKey, now, timeZone),
      items: map.get(dayKey) ?? [],
    };
  });
}
