/**
 * Casino campaign list filters - mirrors the Offers Campaigns tab model
 * (All / Needs action / Active / Completed / Expired) against casino statuses.
 * Day grouping matches Offers Campaigns (Today / Tomorrow / dated sections).
 */
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";
import {
  formatOfferListGroupLabel,
  startOfLocalDay,
} from "@/lib/offers/offer-list-groups";

export type CasinoListFilter = "all" | "needs_action" | "active" | "completed" | "expired";

export { startOfLocalDay, formatOfferListGroupLabel };

function parseYmdLocal(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Primary day for list grouping: occurrence → expiry → completed → created. */
export function casinoListGroupDayMs(
  offer: Pick<CasinoOfferSummary, "instanceDate" | "expiresAt" | "completedAt" | "createdAt">
): number {
  if (offer.instanceDate?.trim()) {
    const fromInstance = parseYmdLocal(offer.instanceDate.trim());
    if (fromInstance != null) return startOfLocalDay(fromInstance);
  }
  if (offer.expiresAt != null) return startOfLocalDay(offer.expiresAt);
  if (offer.completedAt != null) return startOfLocalDay(offer.completedAt);
  return startOfLocalDay(offer.createdAt);
}

/**
 * Day bucket for active feeds — evergreen campaigns (no occurrence/expiry) sit
 * under Today so they are not pushed into the past by createdAt. Past-dated
 * open campaigns also clamp to Today so overdue work stays visible.
 */
export function casinoListFeedGroupDayMs(
  offer: Pick<CasinoOfferSummary, "instanceDate" | "expiresAt" | "completedAt" | "createdAt">,
  now = Date.now()
): number {
  const today = startOfLocalDay(now);
  const hasScopedDay = Boolean(offer.instanceDate?.trim()) || offer.expiresAt != null;
  if (!hasScopedDay) return today;
  const day = casinoListGroupDayMs(offer);
  return day < today ? today : day;
}

export interface CasinoListGroup {
  dayMs: number;
  label: string;
  offers: CasinoOfferSummary[];
}

export type CasinoListDaySort = "ascending" | "descending";

export interface GroupCasinoOffersByListDayOptions {
  now?: number;
  /** ascending = Today → Tomorrow → …; descending = Today → Yesterday → … */
  sort?: CasinoListDaySort;
  /** Drop groups before this day (e.g. hide past sections in active feeds). */
  minDayMs?: number;
  /** Use feed day bucketing (evergreen → Today) instead of raw group day. */
  useFeedDay?: boolean;
}

/** Day order + optional min-day filter; within a day, newest created first. */
export function groupCasinoOffersByListDay(
  offers: CasinoOfferSummary[],
  options: GroupCasinoOffersByListDayOptions = {}
): CasinoListGroup[] {
  const now = options.now ?? Date.now();
  const sort = options.sort ?? "ascending";
  const minDayMs = options.minDayMs;

  const map = new Map<number, CasinoOfferSummary[]>();
  for (const offer of offers) {
    const day = options.useFeedDay
      ? casinoListFeedGroupDayMs(offer, now)
      : casinoListGroupDayMs(offer);
    if (minDayMs != null && day < minDayMs) continue;
    const list = map.get(day) ?? [];
    list.push(offer);
    map.set(day, list);
  }

  const dayCmp =
    sort === "ascending" ? (a: number, b: number) => a - b : (a: number, b: number) => b - a;

  return [...map.entries()]
    .sort((a, b) => dayCmp(a[0], b[0]))
    .map(([dayMs, groupOffers]) => ({
      dayMs,
      label: formatOfferListGroupLabel(dayMs, now),
      offers: groupOffers.sort((a, b) => b.createdAt - a.createdAt),
    }));
}

/** Past expiry while still open, or explicitly marked expired. */
export function isCasinoEffectivelyExpired(
  offer: Pick<CasinoOfferSummary, "status" | "expiresAt">,
  now = Date.now()
): boolean {
  if (offer.status === "expired") return true;
  if (offer.status === "completed") return false;
  return offer.expiresAt != null && offer.expiresAt < now;
}

/** Open work: planned or in progress, not past its window. */
export function isCasinoInMainFeed(
  offer: Pick<CasinoOfferSummary, "status" | "expiresAt">,
  now = Date.now()
): boolean {
  if (offer.status === "completed" || offer.status === "expired") return false;
  if (isCasinoEffectivelyExpired(offer, now)) return false;
  return offer.status === "planned" || offer.status === "active";
}

/**
 * Something still to do: add steps, start, or complete.
 * Casino has no idle "waiting for result" state, so this matches the main feed.
 */
export function casinoNeedsAction(
  offer: Pick<CasinoOfferSummary, "status" | "expiresAt" | "components">,
  now = Date.now()
): boolean {
  return isCasinoInMainFeed(offer, now);
}

export function filterCasinoOffers(
  offers: CasinoOfferSummary[],
  filter: CasinoListFilter,
  now = Date.now()
): CasinoOfferSummary[] {
  switch (filter) {
    case "completed":
      return offers.filter((o) => o.status === "completed");
    case "expired":
      return offers.filter((o) => isCasinoEffectivelyExpired(o, now));
    case "active":
      return offers.filter((o) => o.status === "active" && isCasinoInMainFeed(o, now));
    case "needs_action":
      return offers.filter((o) => casinoNeedsAction(o, now));
    case "all":
    default:
      return offers.filter((o) => isCasinoInMainFeed(o, now));
  }
}
