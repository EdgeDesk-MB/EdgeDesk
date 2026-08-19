/**
 * Group tracked events by kick-off calendar day.
 * Labels match Campaigns (Today / Tomorrow / Yesterday / weekday + ordinal).
 */
import {
  formatOfferListGroupLabel,
  startOfLocalDay,
} from "@/lib/offers/offer-list-groups";

export { formatOfferListGroupLabel, startOfLocalDay };

export type EventListDayFilter = "all" | "today" | "upcoming" | "past";
export type EventListDaySort = "ascending" | "descending" | "upcoming-then-past";

export interface EventListGroup<T> {
  dayMs: number;
  label: string;
  events: T[];
}

export interface GroupEventsByListDayOptions {
  now?: number;
  sort?: EventListDaySort;
  minDayMs?: number;
  maxDayMs?: number;
  /** Keep a single calendar day (date-picker jump). */
  dayMs?: number;
}

export function eventListGroupDayMs(event: { startTime: number }): number {
  return startOfLocalDay(event.startTime);
}

/** Local calendar offset that survives DST (unlike + 86_400_000). */
export function addLocalDays(dayMs: number, days: number): number {
  const d = new Date(dayMs);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function eventListDayBounds(
  filter: EventListDayFilter,
  now: number
): Pick<GroupEventsByListDayOptions, "minDayMs" | "maxDayMs" | "dayMs" | "sort"> {
  const today = startOfLocalDay(now);
  switch (filter) {
    case "today":
      return { dayMs: today, sort: "ascending" };
    case "upcoming":
      return { minDayMs: addLocalDays(today, 1), sort: "ascending" };
    case "past":
      return { maxDayMs: addLocalDays(today, -1), sort: "descending" };
    case "all":
    default:
      return { sort: "upcoming-then-past" };
  }
}

function sortDays(dayMs: number[], sort: EventListDaySort, todayMs: number): number[] {
  if (sort === "upcoming-then-past") {
    const upcoming = dayMs.filter((d) => d >= todayMs).sort((a, b) => a - b);
    const past = dayMs.filter((d) => d < todayMs).sort((a, b) => b - a);
    return [...upcoming, ...past];
  }
  const dayCmp = sort === "ascending" ? (a: number, b: number) => a - b : (a: number, b: number) => b - a;
  return [...dayMs].sort(dayCmp);
}

/** Day order + optional day window; within a day, earliest kick-off first. */
export function groupEventsByListDay<T extends { startTime: number; id?: number }>(
  events: T[],
  options: GroupEventsByListDayOptions = {}
): EventListGroup<T>[] {
  const now = options.now ?? Date.now();
  const sort = options.sort ?? "upcoming-then-past";
  const todayMs = startOfLocalDay(now);

  const map = new Map<number, T[]>();
  for (const event of events) {
    const day = eventListGroupDayMs(event);
    if (options.dayMs != null && day !== options.dayMs) continue;
    if (options.minDayMs != null && day < options.minDayMs) continue;
    if (options.maxDayMs != null && day > options.maxDayMs) continue;
    const list = map.get(day) ?? [];
    list.push(event);
    map.set(day, list);
  }

  return sortDays([...map.keys()], sort, todayMs).map((dayMs) => ({
    dayMs,
    label: formatOfferListGroupLabel(dayMs, now),
    events: (map.get(dayMs) ?? []).sort((a, b) => {
      const byStart = a.startTime - b.startTime;
      if (byStart !== 0) return byStart;
      return (a.id ?? 0) - (b.id ?? 0);
    }),
  }));
}
