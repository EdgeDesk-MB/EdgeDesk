/**
 * Group campaign cards by calendar day for the Offers list.
 */
import type { OfferSummary } from "@/lib/services/offers.types";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseYmdLocal(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Primary day for list grouping: occurrence day → racing day → expiry day → created. */
export function offerListGroupDayMs(offer: OfferSummary): number {
  if (offer.instanceDate?.trim()) {
    const fromInstance = parseYmdLocal(offer.instanceDate.trim());
    if (fromInstance != null) return startOfLocalDay(fromInstance);
  }
  if (offer.eventDate?.trim()) {
    const fromEvent = parseYmdLocal(offer.eventDate.trim());
    if (fromEvent != null) return startOfLocalDay(fromEvent);
  }
  const deadline = effectiveOfferExpiryMs(offer);
  if (deadline != null) return startOfLocalDay(deadline);
  return startOfLocalDay(offer.createdAt);
}

/**
 * Day bucket for active feeds — evergreen offers (no event/expiry) sit under Today
 * so they are not pushed into the past by createdAt.
 */
export function offerListFeedGroupDayMs(offer: OfferSummary, now = Date.now()): number {
  const hasScopedDay = Boolean(offer.eventDate?.trim()) || offer.expiresAt != null;
  if (!hasScopedDay) return startOfLocalDay(now);
  return offerListGroupDayMs(offer);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "Today" / "Tomorrow" / "Yesterday" / "Monday 6th July" (year if not current). */
export function formatOfferListGroupLabel(dayMs: number, now = Date.now()): string {
  const today = startOfLocalDay(now);
  const tomorrow = today + 86_400_000;
  const yesterday = today - 86_400_000;
  if (dayMs === today) return "Today";
  if (dayMs === tomorrow) return "Tomorrow";
  if (dayMs === yesterday) return "Yesterday";

  const d = new Date(dayMs);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const day = ordinal(d.getDate());
  const year = d.getFullYear();
  const thisYear = new Date(now).getFullYear();
  return year !== thisYear
    ? `${weekday} ${day} ${month} ${year}`
    : `${weekday} ${day} ${month}`;
}

export interface OfferListGroup {
  dayMs: number;
  label: string;
  offers: OfferSummary[];
}

export type OfferListDaySort = "ascending" | "descending";

export interface GroupOffersByListDayOptions {
  now?: number;
  /** ascending = Today → Tomorrow → …; descending = Today → Yesterday → … */
  sort?: OfferListDaySort;
  /** Drop groups before this day (e.g. hide past sections in active feeds). */
  minDayMs?: number;
  /** Use feed day bucketing (evergreen → Today) instead of raw group day. */
  useFeedDay?: boolean;
}

/** Past deadline or missed scoped window — belongs in Expired, not the main feed. */
export function isOfferEffectivelyExpired(offer: OfferSummary, now = Date.now()): boolean {
  if (offer.status === "expired") return true;
  if (offer.status === "completed") return false;
  const deadline = effectiveOfferExpiryMs(offer);
  return deadline != null && deadline < now;
}

/** Active campaign feeds: today onward, excluding expired/completed/settled. */
export function isOfferInMainFeed(offer: OfferSummary, now = Date.now()): boolean {
  if (offer.status === "expired" || offer.status === "completed") return false;
  if (offer.profit.freeBetStage === "settled") return false;
  if (isOfferEffectivelyExpired(offer, now)) return false;
  return offerListFeedGroupDayMs(offer, now) >= startOfLocalDay(now);
}

export function isOfferInExpiredFeed(offer: OfferSummary, now = Date.now()): boolean {
  return isOfferEffectivelyExpired(offer, now);
}

/** Day order + optional min-day filter; within a day, newest created first. */
export function groupOffersByListDay(
  offers: OfferSummary[],
  options: GroupOffersByListDayOptions | number = {}
): OfferListGroup[] {
  const opts: GroupOffersByListDayOptions =
    typeof options === "number" ? { now: options } : options;
  const now = opts.now ?? Date.now();
  const sort = opts.sort ?? "ascending";
  const minDayMs = opts.minDayMs;

  const map = new Map<number, OfferSummary[]>();
  for (const offer of offers) {
    const day = opts.useFeedDay ? offerListFeedGroupDayMs(offer, now) : offerListGroupDayMs(offer);
    if (minDayMs != null && day < minDayMs) continue;
    const list = map.get(day) ?? [];
    list.push(offer);
    map.set(day, list);
  }

  const dayCmp = sort === "ascending" ? (a: number, b: number) => a - b : (a: number, b: number) => b - a;

  return [...map.entries()]
    .sort((a, b) => dayCmp(a[0], b[0]))
    .map(([dayMs, groupOffers]) => ({
      dayMs,
      label: formatOfferListGroupLabel(dayMs, now),
      offers: groupOffers.sort((a, b) => b.createdAt - a.createdAt),
    }));
}

/** Short UK date for scope lines, e.g. "9 Jul 2026". */
export function formatOfferEventDay(ymd: string | null | undefined): string | null {
  if (!ymd?.trim()) return null;
  const ms = parseYmdLocal(ymd.trim());
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
