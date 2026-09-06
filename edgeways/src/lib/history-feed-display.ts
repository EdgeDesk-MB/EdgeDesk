import type { EventRow, HistoryRow } from "@/lib/db/schema";
import {
  obsoleteScoreHistoryDedupes,
  scoreTicksCoveredByNamedGoalRows,
} from "@/lib/history-event-rows";

/** Drop leftover score ticks, old promo lines, and duplicate race results. */
export function dedupeHistoryForDisplay(
  rows: HistoryRow[],
  allEvents: EventRow[]
): HistoryRow[] {
  const eventById = new Map(allEvents.map((e) => [e.id, e]));
  const seenRacingResults = new Set<string>();
  const seenPromoBets = new Set<number>();
  const obsoleteScoreTicks = new Set([
    ...allEvents.flatMap((event) => obsoleteScoreHistoryDedupes(event)),
    ...scoreTicksCoveredByNamedGoalRows(rows),
  ]);
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
