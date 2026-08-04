import { eq, inArray } from "drizzle-orm";
import { db, bets, events, history, type HistoryRow } from "@/lib/db";

export interface PurgeSimulationsResult {
  eventsDeleted: number;
  historyDeleted: number;
  betsUnlinked: number;
}

const MATCH_EVENT_KINDS = ["kickoff", "goal", "two_up"] as const;

function isMatchCommentaryRow(row: HistoryRow, eventById: Map<number, { sport: string }>): boolean {
  if ((MATCH_EVENT_KINDS as readonly string[]).includes(row.kind)) return true;
  if (row.kind !== "full_time") return false;
  const ev = row.eventId != null ? eventById.get(row.eventId) : undefined;
  // Orphaned or football full-time - keep horse-racing results only.
  return !ev || ev.sport !== "horse_racing";
}

/** Remove simulated / football match commentary from the history feed. */
export function purgeSimulationData(): PurgeSimulationsResult {
  const allEvents = db.select().from(events).all();
  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const simEvents = allEvents.filter((e) => e.source === "sim");
  const simIds = simEvents.map((e) => e.id);

  let historyDeleted = 0;

  if (simIds.length > 0) {
    historyDeleted += db.delete(history).where(inArray(history.eventId, simIds)).run().changes;
  }

  const rows = db.select().from(history).all();
  const matchRowIds = rows.filter((r) => isMatchCommentaryRow(r, eventById)).map((r) => r.id);
  if (matchRowIds.length > 0) {
    historyDeleted += db.delete(history).where(inArray(history.id, matchRowIds)).run().changes;
  }

  let betsUnlinked = 0;
  let eventsDeleted = 0;

  if (simIds.length > 0) {
    betsUnlinked = db
      .update(bets)
      .set({ eventId: null })
      .where(inArray(bets.eventId, simIds))
      .run().changes;
    eventsDeleted = db.delete(events).where(eq(events.source, "sim")).run().changes;
  }

  return { eventsDeleted, historyDeleted, betsUnlinked };
}
