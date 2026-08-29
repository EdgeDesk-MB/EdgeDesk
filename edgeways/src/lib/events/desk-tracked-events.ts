import type { BetRow, EventRow } from "@/lib/db/schema";

/** Fixtures this desk should show: followed, or still needed for an open bet. */
export function deskVisibleEventIds(
  followedIds: number[],
  bets: Pick<BetRow, "eventId" | "status">[]
): Set<number> {
  const ids = new Set(followedIds);
  for (const bet of bets) {
    if (bet.eventId != null && bet.status === "open") ids.add(bet.eventId);
  }
  return ids;
}

export function filterEventsForDesk(
  events: EventRow[],
  followedIds: number[],
  bets: Pick<BetRow, "eventId" | "status">[]
): EventRow[] {
  const keep = deskVisibleEventIds(followedIds, bets);
  if (keep.size === 0) return [];
  return events.filter((event) => keep.has(event.id));
}
