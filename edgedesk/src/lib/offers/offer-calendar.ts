import type { OfferSummary } from "@/lib/services/offers";
import { deriveOfferNextAction } from "@/lib/offers/next-actions";

export type OfferCalendarKind = "expires" | "planned" | "action";

export interface OfferCalendarItem {
  offerId: number;
  offer: OfferSummary;
  kind: OfferCalendarKind;
  label: string;
  detail: string;
  sortKey: number;
}

export interface OfferCalendarDay {
  /** YYYY-MM-DD local */
  dateKey: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  items: OfferCalendarItem[];
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

/**
 * Day-split offer calendar: expiries, planned starts, and do-now actions
 * across the next `horizonDays` (default 14). Prefers day lists over month grids.
 */
export function buildOfferCalendarDays(
  offers: OfferSummary[],
  options?: { now?: number; horizonDays?: number }
): OfferCalendarDay[] {
  const now = options?.now ?? Date.now();
  const horizonDays = options?.horizonDays ?? 14;
  const today = startOfLocalDay(new Date(now));
  const todayKey = dateKeyLocal(today.getTime());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKeyLocal(tomorrow.getTime());
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays);

  const byDay = new Map<string, OfferCalendarItem[]>();

  function push(dateMs: number, item: Omit<OfferCalendarItem, "sortKey"> & { sortKey?: number }) {
    const day = startOfLocalDay(new Date(dateMs));
    if (day < today || day > horizonEnd) return;
    const key = dateKeyLocal(day.getTime());
    const list = byDay.get(key) ?? [];
    list.push({ ...item, sortKey: item.sortKey ?? dateMs });
    byDay.set(key, list);
  }

  for (const offer of offers) {
    if (offer.status === "expired") continue;

    if (offer.expiresAt != null && offer.expiresAt >= today.getTime()) {
      push(offer.expiresAt, {
        offerId: offer.id,
        offer,
        kind: "expires",
        label: "Expires",
        detail: offer.title,
      });
    }

    if (offer.status === "planned" && offer.betCount === 0) {
      const plannedAt =
        offer.expiresAt != null
          ? Math.min(offer.expiresAt, today.getTime())
          : offer.createdAt >= today.getTime() && offer.createdAt <= horizonEnd.getTime()
            ? offer.createdAt
            : today.getTime();
      push(plannedAt, {
        offerId: offer.id,
        offer,
        kind: "planned",
        label: "Planned",
        detail: offer.title,
        sortKey: plannedAt - 1,
      });
    }

    const action = deriveOfferNextAction(offer, now);
    if (
      action &&
      (action.kind === "convert_free_bet" ||
        action.kind === "finish_conversion" ||
        action.kind === "place_qualifying" ||
        action.kind === "start_planned" ||
        action.kind === "review_expiry")
    ) {
      push(today.getTime(), {
        offerId: offer.id,
        offer,
        kind: "action",
        label: action.title,
        detail: action.detail,
        sortKey: today.getTime() + action.priority,
      });
    }
  }

  return [...byDay.keys()]
    .sort()
    .map((key) => {
      const items = (byDay.get(key) ?? []).sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.offer.title.localeCompare(b.offer.title);
      });
      const seen = new Set<string>();
      const deduped = items.filter((item) => {
        const id = `${item.offerId}:${item.kind}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return {
        dateKey: key,
        label: formatDayLabel(key, todayKey, tomorrowKey),
        isToday: key === todayKey,
        isTomorrow: key === tomorrowKey,
        items: deduped,
      };
    })
    .filter((d) => d.items.length > 0);
}
