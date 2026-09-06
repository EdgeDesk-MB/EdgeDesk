/**
 * Profit Tracker day bands — same Today / Yesterday / weekday labels as
 * Tracked Events (`ListDaySection` + `formatOfferListGroupLabel`).
 * Newest calendar day first (future, then Today, then Yesterday).
 * Campaigns bucket by bet/event activity, not the offer's planned date.
 */
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import { betNeedsLay, type BetCampaignGroup } from "@/lib/bets/desk-queues";
import {
  formatOfferListGroupLabel,
  offerListGroupDayMs,
  startOfLocalDay,
} from "@/lib/offers/offer-list-groups";

export interface TrackerCampaignDayGroup {
  dayMs: number;
  label: string;
  upcoming: boolean;
  groups: BetCampaignGroup[];
}

export interface TrackerBetDayGroup {
  dayMs: number;
  label: string;
  upcoming: boolean;
  bets: BetRow[];
}

export function isFutureListDay(dayMs: number, now = Date.now()): boolean {
  return dayMs > startOfLocalDay(now);
}

export function betTrackerListDayMs(
  bet: BetRow,
  eventById: Map<number, Pick<EventRow, "startTime">>,
  offer?: OfferSummary | null
): number {
  const event = bet.eventId != null ? eventById.get(bet.eventId) : undefined;
  if (event?.startTime) return startOfLocalDay(event.startTime);
  if (offer) return offerListGroupDayMs(offer);
  return startOfLocalDay(bet.createdAt);
}

export function campaignTrackerListDayMs(
  group: BetCampaignGroup,
  eventById: Map<number, Pick<EventRow, "startTime">>
): number {
  const eventDays = group.bets.flatMap((bet) => {
    const event = bet.eventId != null ? eventById.get(bet.eventId) : undefined;
    return event?.startTime ? [startOfLocalDay(event.startTime)] : [];
  });
  if (eventDays.length > 0) return Math.max(...eventDays);
  if (group.bets.length > 0) {
    return Math.max(...group.bets.map((bet) => startOfLocalDay(bet.createdAt)));
  }
  if (group.offer) return offerListGroupDayMs(group.offer);
  return startOfLocalDay(Date.now());
}

/** Latest calendar day first so future work sits above Today, then the past log. */
function sortDaysNewestFirst(dayMs: number[]): number[] {
  return [...dayMs].sort((a, b) => b - a);
}

/** Split the trailing Unlinked bets bucket so each calendar day is its own card. */
export function explodeOrphanCampaignsByDay(
  groups: BetCampaignGroup[],
  eventById: Map<number, Pick<EventRow, "startTime">>
): BetCampaignGroup[] {
  const result: BetCampaignGroup[] = [];
  for (const group of groups) {
    if (group.offerId != null) {
      result.push(group);
      continue;
    }
    const byDay = new Map<number, BetRow[]>();
    for (const bet of group.bets) {
      const day = betTrackerListDayMs(bet, eventById, null);
      const list = byDay.get(day) ?? [];
      list.push(bet);
      byDay.set(day, list);
    }
    for (const day of sortDaysNewestFirst([...byDay.keys()])) {
      const bets = byDay.get(day) ?? [];
      result.push({
        ...group,
        bets,
        openCount: bets.filter((b) => b.status === "open").length,
        needsLayCount: bets.filter(betNeedsLay).length,
      });
    }
  }
  return result;
}

export function groupCampaignsByListDay(
  groups: BetCampaignGroup[],
  eventById: Map<number, Pick<EventRow, "startTime">>,
  now = Date.now()
): TrackerCampaignDayGroup[] {
  const exploded = explodeOrphanCampaignsByDay(groups, eventById);
  const map = new Map<number, BetCampaignGroup[]>();
  for (const group of exploded) {
    const day = campaignTrackerListDayMs(group, eventById);
    const list = map.get(day) ?? [];
    list.push(group);
    map.set(day, list);
  }
  return sortDaysNewestFirst([...map.keys()]).map((dayMs) => ({
    dayMs,
    label: formatOfferListGroupLabel(dayMs, now),
    upcoming: isFutureListDay(dayMs, now),
    groups: map.get(dayMs) ?? [],
  }));
}

export function flattenTrackerCampaignGroups(
  sections: TrackerCampaignDayGroup[]
): BetCampaignGroup[] {
  return sections.flatMap((section) => section.groups);
}

export function groupBetsByListDay(
  bets: BetRow[],
  eventById: Map<number, Pick<EventRow, "startTime">>,
  offerById: Map<number, OfferSummary>,
  now = Date.now()
): TrackerBetDayGroup[] {
  const map = new Map<number, BetRow[]>();
  for (const bet of bets) {
    const offer = bet.offerId != null ? (offerById.get(bet.offerId) ?? null) : null;
    const day = betTrackerListDayMs(bet, eventById, offer);
    const list = map.get(day) ?? [];
    list.push(bet);
    map.set(day, list);
  }
  return sortDaysNewestFirst([...map.keys()]).map((dayMs) => ({
    dayMs,
    label: formatOfferListGroupLabel(dayMs, now),
    upcoming: isFutureListDay(dayMs, now),
    bets: map.get(dayMs) ?? [],
  }));
}
