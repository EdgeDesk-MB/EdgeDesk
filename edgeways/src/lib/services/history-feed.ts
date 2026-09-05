import { desc, eq, isNotNull, and, notInArray } from "drizzle-orm";
import {
  db,
  history,
  events,
  bets,
  offers,
  type HistoryRow,
  type EventRow,
  type BetRow,
} from "@/lib/db";
import { getPromoAwardsByBetId } from "@/lib/services/balances";
import {
  buildHistoryContext,
  isHiddenHistoryFeedEntry,
  sortHistoryEntries,
  type HistoryContext,
  type HistoryFilter,
  matchesHistoryFilter,
} from "@/lib/history-display";
import { isChartAnnotationEntry } from "@/lib/pnl/chart-bet-markers";
import { obsoleteScoreHistoryDedupes } from "@/lib/history-event-rows";

/** Set or clear the user note on a balance-correction history row. */
export function updateHistoryNote(id: number, note: string | null): HistoryRow | null {
  const row = db.select().from(history).where(eq(history.id, id)).get();
  if (!row || row.kind !== "balance_adjustment") return null;
  const next = note?.trim() ? note.trim() : null;
  db.update(history).set({ note: next }).where(eq(history.id, id)).run();
  return db.select().from(history).where(eq(history.id, id)).get() ?? null;
}

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
  const obsoleteScoreTicks = new Set(
    allEvents.flatMap((event) => obsoleteScoreHistoryDedupes(event))
  );
  const out: HistoryRow[] = [];

  for (const row of rows) {
    if (obsoleteScoreTicks.has(row.dedupe)) continue;
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
  offerTitles: Array<{ id: number; title: string }>;
}

function loadOfferTitles(): Array<{ id: number; title: string }> {
  return db
    .select({ id: offers.id, title: offers.title })
    .from(offers)
    .all();
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
  const offerTitles = loadOfferTitles();

  const raw = dedupeHistoryForDisplay(
    db.select().from(history).orderBy(desc(history.createdAt), desc(history.id)).limit(limit * 2).all(),
    allEvents
  );
  const context = buildHistoryContext(allEvents, allBets, promoAwards, offerTitles, raw);

  let entries = sortHistoryEntries(raw, context).filter(
    (e) => !isHiddenHistoryFeedEntry(e, context)
  );
  if (options?.filter && options.filter !== "all") {
    entries = entries.filter((e) => matchesHistoryFilter(e, options.filter!, context));
  }
  entries = entries.slice(0, limit);

  return { entries, events: allEvents, bets: allBets, context, promoAwards, offerTitles };
}

/** All feed rows that qualify as chart money-position annotations (not limited to feed page size). */
export function getChartAnnotationHistory(
  allEvents: EventRow[],
  allBets: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }>
): HistoryRow[] {
  const context = buildHistoryContext(allEvents, allBets, promoAwards, loadOfferTitles());
  const rows = db.select().from(history).all();
  return rows.filter((entry) => isChartAnnotationEntry(entry, context));
}
