import { desc, eq, isNotNull, and, notInArray } from "drizzle-orm";
import { db, history, events, bets, type HistoryRow, type EventRow, type BetRow } from "@/lib/db";
import { getPromoAwardsByBetId } from "@/lib/services/balances";
import {
  buildHistoryContext,
  sortHistoryEntries,
  type HistoryContext,
  type HistoryFilter,
  matchesHistoryFilter,
} from "@/lib/history-display";

/** Remove all commentary feed rows tied to a bet (placed + settlement lines). */
export function purgeHistoryForBet(betId: number): number {
  const before = db.select().from(history).where(eq(history.betId, betId)).all();
  db.delete(history).where(eq(history.betId, betId)).run();
  return before.length;
}

/** Remove history rows whose bet was deleted before purge-on-delete existed. */
export function purgeOrphanedBetHistory(): number {
  const betIds = db.select({ id: bets.id }).from(bets).all().map((b) => b.id);
  const linked = db.select().from(history).where(isNotNull(history.betId)).all();
  const orphaned = linked.filter((row) => row.betId != null && !betIds.includes(row.betId));
  if (orphaned.length === 0) return 0;

  if (betIds.length === 0) {
    db.delete(history).where(isNotNull(history.betId)).run();
  } else {
    db.delete(history)
      .where(and(isNotNull(history.betId), notInArray(history.betId, betIds)))
      .run();
  }
  return orphaned.length;
}

/** Drop legacy duplicate rows from the feed (old promo lines, duplicate race results). */
export function dedupeHistoryForDisplay(rows: HistoryRow[], allEvents: EventRow[]): HistoryRow[] {
  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const seenRacingResults = new Set<string>();
  const seenPromoBets = new Set<number>();
  const out: HistoryRow[] = [];

  for (const row of rows) {
    if (row.kind === "free_bet_promo") {
      if (row.betId == null || seenPromoBets.has(row.betId)) continue;
      seenPromoBets.add(row.betId);
      continue;
    }
    if (row.kind === "full_time" && row.eventId != null) {
      const ev = eventById.get(row.eventId);
      if (ev?.sport === "horse_racing") {
        const key = ev.externalId ?? `local:${ev.competition}:${ev.startTime}`;
        if (seenRacingResults.has(key)) continue;
        seenRacingResults.add(key);
      }
    }
    out.push(row);
  }
  return out;
}

export interface HistoryFeedResult {
  entries: HistoryRow[];
  events: EventRow[];
  bets: BetRow[];
  context: HistoryContext;
  promoAwards: Record<number, { amount: number; reason: string }>;
}

export function getHistoryFeed(options?: {
  limit?: number;
  filter?: HistoryFilter;
}): HistoryFeedResult {
  purgeOrphanedBetHistory();
  const limit = options?.limit ?? 200;
  const allEvents = db.select().from(events).all();
  const allBets = db.select().from(bets).all();
  const promoAwards = getPromoAwardsByBetId();
  const context = buildHistoryContext(allEvents, allBets, promoAwards);

  const raw = dedupeHistoryForDisplay(
    db.select().from(history).orderBy(desc(history.createdAt), desc(history.id)).limit(limit * 2).all(),
    allEvents
  );

  let entries = sortHistoryEntries(raw, context);
  if (options?.filter && options.filter !== "all") {
    entries = entries.filter((e) => matchesHistoryFilter(e, options.filter!, context));
  }
  entries = entries.slice(0, limit);

  return { entries, events: allEvents, bets: allBets, context, promoAwards };
}
