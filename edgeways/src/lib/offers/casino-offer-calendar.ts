/**
 * Casino offer calendar (day-split, expiry-driven) - the Casino desk's
 * counterpart to `offer-calendar.ts`, kept as a SIBLING module rather than a
 * merge: a casino campaign has no qualifying→conversion pipeline, no
 * "next action", and no sport/category concept the way a sports offer does,
 * so it doesn't need that module's priority-scoring machinery. This is
 * deliberately simpler - just "what expires when" over a 14-day horizon,
 * matching the app's stated day-split-lists-not-month-grids preference.
 */

import { daysUntilOfferExpiry, offerExpiryUrgency } from "@/lib/offers/offer-expiry";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export interface CasinoCalendarItem {
  offerId: number;
  offer: CasinoOfferSummary;
  /** Days until expiry (never null for a calendar item - only offers WITH an expiry appear) */
  daysLeft: number;
  urgency: "today" | "tomorrow" | "normal";
}

export interface CasinoCalendarDay {
  /** YYYY-MM-DD local */
  dateKey: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  items: CasinoCalendarItem[];
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKeyLocal(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(dateKey: string, todayKey: string, tomorrowKey: string): string {
  if (dateKey === todayKey) return "Today";
  if (dateKey === tomorrowKey) return "Tomorrow";
  const [y, m, d] = dateKey.split("-").map(Number);
  const when = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return when.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** Active calendar campaigns only - a completed or already-expired campaign has nothing left to schedule. */
export function isCasinoOfferInCalendar(offer: CasinoOfferSummary): boolean {
  return offer.status !== "completed" && offer.status !== "expired";
}

/**
 * Day-split casino calendar: one card per campaign on its expiry day, across
 * the next `horizonDays` (default 14). Campaigns without a known expiry
 * don't have a day to sit on, so they simply don't appear here - they're
 * still visible on the Campaigns list.
 */
export function buildCasinoCalendarDays(
  offers: CasinoOfferSummary[],
  options?: { now?: number; horizonDays?: number }
): CasinoCalendarDay[] {
  const now = options?.now ?? Date.now();
  const horizonDays = options?.horizonDays ?? 14;
  const today = startOfLocalDay(new Date(now));
  const todayKey = dateKeyLocal(today.getTime());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKeyLocal(tomorrow.getTime());
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const byDay = new Map<string, CasinoCalendarItem[]>();

  for (const offer of offers) {
    if (!isCasinoOfferInCalendar(offer)) continue;
    if (offer.expiresAt == null) continue;

    const day = startOfLocalDay(new Date(offer.expiresAt));
    if (day < today || day > horizonEnd) continue;

    const daysLeft = daysUntilOfferExpiry(offer.expiresAt, now) ?? 0;
    const key = dateKeyLocal(day.getTime());
    const list = byDay.get(key) ?? [];
    list.push({
      offerId: offer.id,
      offer,
      daysLeft,
      urgency: offerExpiryUrgency(daysLeft),
    });
    byDay.set(key, list);
  }

  return [...byDay.keys()]
    .sort()
    .map((key) => {
      const items = (byDay.get(key) ?? []).sort((a, b) =>
        a.offer.title.localeCompare(b.offer.title)
      );
      return {
        dateKey: key,
        label: formatDayLabel(key, todayKey, tomorrowKey),
        isToday: key === todayKey,
        isTomorrow: key === tomorrowKey,
        items,
      };
    })
    .filter((d) => d.items.length > 0);
}

export function casinoCalendarHasItems(offers: CasinoOfferSummary[], now = Date.now()): boolean {
  return buildCasinoCalendarDays(offers, { now }).length > 0;
}
