import type { OfferSummary } from "@/lib/services/offers.types";
import { deriveOfferNextAction } from "@/lib/offers/next-actions";
import type { OfferNextActionKind } from "@/lib/offers/next-actions";
import { scoreOfferAdvantage } from "@/lib/offers/advantage";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { isOfferEffectivelyExpired } from "@/lib/offers/offer-list-groups";
import { recurringDetailPrefix } from "@/lib/offers/offer-recurrence-shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export type OfferCalendarKind = "expires" | "planned" | "action";

/** Task-board columns - urgency-first, not a month grid. */
export type OfferCalendarColumnId = "today" | "this_week" | "later";

export type OfferCalendarPriority = "critical" | "high" | "medium" | "low";

export interface OfferCalendarItem {
  offerId: number;
  offer: OfferSummary;
  kind: OfferCalendarKind;
  label: string;
  detail: string;
  sortKey: number;
  /** Days until expiry (null if none) */
  daysLeft: number | null;
  priority: OfferCalendarPriority;
  /** Advantage score when available - higher = better to do next */
  advantageScore: number;
  remainingEv: number;
  /** Set for action cards — drives convert-first ranking */
  actionKind?: OfferNextActionKind;
  /** Nominal free-bet face value when actionKind is convert_free_bet */
  freeBetAmount?: number;
}

export interface OfferCalendarDay {
  /** YYYY-MM-DD local */
  dateKey: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  items: OfferCalendarItem[];
}

export interface OfferCalendarColumn {
  id: OfferCalendarColumnId;
  title: string;
  description: string;
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

/** Active calendar campaigns only — mirrors main feed rules plus recurring day scope. */
export function isOfferInCalendar(offer: OfferSummary, now = Date.now()): boolean {
  if (offer.status === "expired" || offer.status === "completed") return false;
  if (offer.profit.freeBetStage === "settled") return false;
  if (isOfferEffectivelyExpired(offer, now)) return false;

  const todayKey = dateKeyLocal(startOfLocalDay(new Date(now)).getTime());
  const instanceDate =
    offer.instanceDate?.trim() || offer.recurrence?.instanceDate?.trim() || null;
  // Hosted Neon rows keep instance_date after a SQLite copy even when series_id
  // is null. Yesterday's racing day must not sit on Today's board.
  if (instanceDate && instanceDate < todayKey) {
    return false;
  }

  return true;
}

function offerCalendarDayKey(offer: OfferSummary): string | null {
  const instance =
    offer.instanceDate?.trim() || offer.recurrence?.instanceDate?.trim() || "";
  if (instance) return instance;
  const eventDate = offer.eventDate?.trim();
  if (eventDate) return eventDate;
  const startsOn = offer.startsOn?.trim();
  if (startsOn) return startsOn;
  return null;
}

/** Occurrence day from instance / event / start, else the fallback. */
function calendarOccurrenceMs(
  offer: OfferSummary,
  fallbackMs: number
): number {
  const ymd = offerCalendarDayKey(offer);
  if (ymd) return new Date(`${ymd}T00:00:00`).getTime();
  return fallbackMs;
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

function daysUntilExpiry(expiresAt: number | null, now: number): number | null {
  if (expiresAt == null) return null;
  return (expiresAt - now) / (24 * 60 * 60 * 1000);
}

/**
 * Priority chrome (bars, elevated tiers) only for today/tomorrow work:
 * do-now actions, planned starts, and expiries within two days.
 * Further-out cards stay neutral so the board does not read as all-High.
 */
export function isCalendarPriorityWindow(input: {
  kind: OfferCalendarKind;
  daysLeft: number | null;
}): boolean {
  if (input.kind === "action" || input.kind === "planned") return true;
  return input.daysLeft != null && input.daysLeft < 2;
}

export function priorityFromSignals(input: {
  kind: OfferCalendarKind;
  daysLeft: number | null;
  advantageScore: number;
  actionPriority?: number;
}): OfferCalendarPriority {
  const { kind, daysLeft, advantageScore, actionPriority } = input;
  if (!isCalendarPriorityWindow({ kind, daysLeft })) return "low";
  if (kind === "action" && (actionPriority ?? 99) <= 12) return "critical";
  if (daysLeft != null && daysLeft <= 1) return "critical";
  if (daysLeft != null && daysLeft <= 3) return "high";
  if (kind === "action" || advantageScore >= 8) return "high";
  if (daysLeft != null && daysLeft <= 7) return "medium";
  if (kind === "expires" || kind === "planned") return "medium";
  return "low";
}

function pickBetterCalendarItem(
  prev: OfferCalendarItem,
  item: OfferCalendarItem
): boolean {
  const pRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return (
    pRank[item.priority] < pRank[prev.priority] ||
    (pRank[item.priority] === pRank[prev.priority] &&
      item.advantageScore > prev.advantageScore) ||
    (item.kind === "action" && prev.kind !== "action")
  );
}

function isConvertCalendarItem(item: OfferCalendarItem): boolean {
  return item.kind === "action" && item.actionKind === "convert_free_bet";
}

function calendarFreeBetFaceValue(item: OfferCalendarItem): number {
  return item.freeBetAmount ?? item.offer.profit.freeBetAwardAmount ?? 0;
}

function compareCalendarItems(a: OfferCalendarItem, b: OfferCalendarItem): number {
  const aConvert = isConvertCalendarItem(a);
  const bConvert = isConvertCalendarItem(b);
  if (aConvert && !bConvert) return -1;
  if (!aConvert && bConvert) return 1;
  if (aConvert && bConvert) {
    const byFace = calendarFreeBetFaceValue(b) - calendarFreeBetFaceValue(a);
    if (byFace !== 0) return byFace;
  }
  const pRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  if (pRank[a.priority] !== pRank[b.priority]) {
    return pRank[a.priority] - pRank[b.priority];
  }
  if (b.advantageScore !== a.advantageScore) return b.advantageScore - a.advantageScore;
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
  return a.offer.title.localeCompare(b.offer.title);
}

function sortCalendarItems(items: OfferCalendarItem[]): OfferCalendarItem[] {
  return [...items].sort(compareCalendarItems);
}

/** One card per offer per day — keeps the most urgent signal (action beats expires). */
function dedupeDayItems(items: OfferCalendarItem[]): OfferCalendarItem[] {
  const byOffer = new Map<number, OfferCalendarItem>();
  for (const item of items) {
    const prev = byOffer.get(item.offerId);
    if (!prev || pickBetterCalendarItem(prev, item)) {
      byOffer.set(item.offerId, item);
    }
  }
  return sortCalendarItems([...byOffer.values()]);
}

function enrichItem(
  base: Omit<OfferCalendarItem, "daysLeft" | "priority" | "advantageScore" | "remainingEv" | "sortKey"> & {
    sortKey?: number;
  },
  now: number,
  actionPriority?: number
): OfferCalendarItem {
  const adv = scoreOfferAdvantage(base.offer, now);
  const daysLeft = daysUntilExpiry(effectiveOfferExpiryMs(base.offer), now);
  const advantageScore = adv?.score ?? 0;
  const remainingEv = adv?.remainingEv ?? 0;
  const priority = priorityFromSignals({
    kind: base.kind,
    daysLeft,
    advantageScore,
    actionPriority,
  });
  return {
    ...base,
    sortKey: base.sortKey ?? now,
    daysLeft,
    priority,
    advantageScore,
    remainingEv,
  };
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

  function push(
    dateMs: number,
    item: Omit<OfferCalendarItem, "sortKey" | "daysLeft" | "priority" | "advantageScore" | "remainingEv"> & {
      sortKey?: number;
      actionPriority?: number;
    }
  ) {
    const day = startOfLocalDay(new Date(dateMs));
    if (day < today || day > horizonEnd) return;
    const key = dateKeyLocal(day.getTime());
    const list = byDay.get(key) ?? [];
    const { actionPriority, ...rest } = item;
    list.push(enrichItem({ ...rest, sortKey: item.sortKey ?? dateMs }, now, actionPriority));
    byDay.set(key, list);
  }

  for (const offer of offers) {
    if (!isOfferInCalendar(offer, now)) continue;

    const recurPrefix = recurringDetailPrefix(offer.recurrence?.rule);
    const detailTitle = `${recurPrefix}${offer.title}`;

    const deadline = effectiveOfferExpiryMs(offer);
    if (deadline != null && deadline >= today.getTime()) {
      push(deadline, {
        offerId: offer.id,
        offer,
        kind: "expires",
        label: offer.recurrence?.enabled ? "Recurring · expires" : "Expires",
        detail: detailTitle,
      });
    }

    if (offer.status === "planned" && offer.betCount === 0) {
      const occurrenceMs = calendarOccurrenceMs(offer, today.getTime());
      const plannedAt =
        occurrenceMs >= today.getTime()
          ? occurrenceMs
          : deadline != null
            ? Math.min(deadline, today.getTime())
            : offer.createdAt >= today.getTime() && offer.createdAt <= horizonEnd.getTime()
              ? offer.createdAt
              : today.getTime();
      push(plannedAt, {
        offerId: offer.id,
        offer,
        kind: "planned",
        label: offer.recurrence?.enabled ? "Recurring" : "Planned",
        detail: detailTitle,
        sortKey: plannedAt - 1,
      });
    }

    const action = deriveOfferNextAction(offer, now);
    if (
      action &&
      (action.kind === "convert_free_bet" ||
        action.kind === "place_qualifying" ||
        action.kind === "start_planned" ||
        action.kind === "review_expiry" ||
        action.kind === "desk_lay")
    ) {
      const occurrenceMs = calendarOccurrenceMs(offer, today.getTime());
      const actionDayMs = occurrenceMs >= today.getTime() ? occurrenceMs : today.getTime();
      push(actionDayMs, {
        offerId: offer.id,
        offer,
        kind: "action",
        label: action.title,
        detail: action.detail,
        sortKey: actionDayMs + action.priority,
        actionPriority: action.priority,
        actionKind: action.kind,
        freeBetAmount: action.freeBetAmount,
      });
    }
  }

  return [...byDay.keys()]
    .sort()
    .map((key) => {
      const items = sortCalendarItems(byDay.get(key) ?? []);
      return {
        dateKey: key,
        label: formatDayLabel(key, todayKey, tomorrowKey),
        isToday: key === todayKey,
        isTomorrow: key === tomorrowKey,
        items: dedupeDayItems(items),
      };
    })
    .filter((d) => d.items.length > 0);
}

function columnForItem(item: OfferCalendarItem, now: number): OfferCalendarColumnId {
  const today = startOfLocalDay(new Date(now)).getTime();
  const occurrenceMs = calendarOccurrenceMs(item.offer, today);

  if (occurrenceMs > today) {
    const daysOut = (occurrenceMs - today) / DAY_MS;
    if (daysOut <= 7) return "this_week";
    return "later";
  }

  const days = item.daysLeft;
  // Today = work for this calendar day only (actions, planned starts, ends today)
  if (item.kind === "action" || item.kind === "planned") return "today";
  if (days != null && days < 1) return "today";
  if (days != null && days <= 7) return "this_week";
  if (item.kind === "expires" && days != null && days <= 14) return "this_week";
  if (item.offer.createdAt >= now - 3 * DAY_MS) return "this_week";
  return "later";
}

/**
 * Priority task board: Today / This week / Later.
 * Dedupes to one card per offer (best/most urgent signal wins).
 * Today only includes today's actions, planned starts, and same-day expiries.
 */
export function buildOfferCalendarBoard(
  offers: OfferSummary[],
  options?: { now?: number; horizonDays?: number }
): OfferCalendarColumn[] {
  const now = options?.now ?? Date.now();
  const days = buildOfferCalendarDays(offers, options);
  const bestByOffer = new Map<number, OfferCalendarItem>();

  for (const day of days) {
    for (const item of day.items) {
      const prev = bestByOffer.get(item.offerId);
      if (!prev || pickBetterCalendarItem(prev, item)) {
        bestByOffer.set(item.offerId, item);
      }
    }
  }

  const columns: OfferCalendarColumn[] = [
    {
      id: "today",
      title: "Today",
      description: "Actions and expiries for today",
      items: [],
    },
    {
      id: "this_week",
      title: "This week",
      description: "Expiries and starts in the next 7 days",
      items: [],
    },
    {
      id: "later",
      title: "Later",
      description: "Further out in the 14-day window",
      items: [],
    },
  ];

  for (const item of bestByOffer.values()) {
    const colId = columnForItem(item, now);
    const col = columns.find((c) => c.id === colId)!;
    col.items.push(item);
  }

  for (const col of columns) {
    col.items = sortCalendarItems(col.items);
  }

  return columns;
}

/** Filter board/agenda items by priority. `null` or empty set = show all. */
export function filterCalendarBoardByPriority(
  columns: OfferCalendarColumn[],
  priorities: ReadonlySet<OfferCalendarPriority> | null
): OfferCalendarColumn[] {
  if (!priorities || priorities.size === 0) return columns;
  return columns.map((col) => ({
    ...col,
    items: col.items.filter((item) => priorities.has(item.priority)),
  }));
}

export function filterCalendarDaysByPriority(
  days: OfferCalendarDay[],
  priorities: ReadonlySet<OfferCalendarPriority> | null
): OfferCalendarDay[] {
  if (!priorities || priorities.size === 0) return days;
  return days
    .map((day) => ({
      ...day,
      items: day.items.filter((item) => priorities.has(item.priority)),
    }))
    .filter((day) => day.items.length > 0);
}

export function countCalendarPriorities(
  offers: OfferSummary[],
  options?: { now?: number; horizonDays?: number }
): Record<OfferCalendarPriority, number> {
  const counts: Record<OfferCalendarPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const col of buildOfferCalendarBoard(offers, options)) {
    for (const item of col.items) {
      counts[item.priority] += 1;
    }
  }
  return counts;
}

export function offerCalendarHasItems(offers: OfferSummary[], now = Date.now()): boolean {
  return buildOfferCalendarDays(offers, { now }).length > 0;
}
