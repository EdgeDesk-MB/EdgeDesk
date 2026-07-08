/**
 * Pull race results from The Racing API for tracked events missing `goals`.
 */
import { eq } from "drizzle-orm";
import { db, bets, events, type EventRow } from "@/lib/db";
import { formatRacingEventTitle } from "@/lib/events";
import { parseRaceResults } from "@/lib/racing";
import {
  hasRacingApiKey,
  raceResultToGoals,
  resultsForRaceIds,
} from "@/lib/services/theracingapi";

export interface RacingSyncResult {
  updated: number;
  pending: number;
  settledLabels: string[];
}

export function eventNeedsRaceResult(event: EventRow): boolean {
  if (event.sport !== "horse_racing" || !event.externalId?.trim()) return false;
  return !parseRaceResults(event.goals);
}

/** True when the race should have started — autopilot polls these windows. */
export function eventInRacingSyncWindow(event: EventRow, now = Date.now()): boolean {
  if (!eventNeedsRaceResult(event)) return false;
  // Poll from 2 min before off until 6 hours after (results can lag)
  return event.startTime <= now + 2 * 60 * 1000 && event.startTime > now - 6 * 60 * 60 * 1000;
}

/** Fetch API results for the given events (or all pending if omitted). */
export async function syncRacingResultsForEvents(
  eventIds?: number[]
): Promise<RacingSyncResult> {
  if (!hasRacingApiKey()) return { updated: 0, pending: 0, settledLabels: [] };

  const now = Date.now();
  const idSet = eventIds ? new Set(eventIds) : null;

  const candidates = db
    .select()
    .from(events)
    .all()
    .filter((e) => {
      if (!eventNeedsRaceResult(e)) return false;
      if (idSet && !idSet.has(e.id)) return false;
      if (!eventInRacingSyncWindow(e, now)) return false;
      return true;
    });

  if (candidates.length === 0) return { updated: 0, pending: 0, settledLabels: [] };

  let updated = 0;
  let pending = 0;
  const settledLabels: string[] = [];

  try {
    const results = await resultsForRaceIds(candidates.map((e) => e.externalId!));
    for (const event of candidates) {
      const result = results.get(event.externalId!);
      if (!result) {
        pending += 1;
        if (event.startTime <= now && event.status === "upcoming") {
          db.update(events).set({ status: "live" }).where(eq(events.id, event.id)).run();
        }
        continue;
      }
      db.update(events)
        .set({
          status: "finished",
          goals: raceResultToGoals(result),
          homeScore: 1,
          awayScore: 0,
        })
        .where(eq(events.id, event.id))
        .run();
      updated += 1;
      settledLabels.push(formatRacingEventTitle(event));
    }
  } catch {
    pending = candidates.length;
  }

  return { updated, pending, settledLabels };
}

/** Sync results for every horse-racing event linked to an open bet. */
export async function syncRacingResultsForOpenBets(): Promise<RacingSyncResult> {
  const eventIds = [
    ...new Set(
      db
        .select({ eventId: bets.eventId })
        .from(bets)
        .where(eq(bets.status, "open"))
        .all()
        .map((b) => b.eventId)
        .filter((id): id is number => id != null)
    ),
  ];
  if (eventIds.length === 0) return { updated: 0, pending: 0, settledLabels: [] };
  return syncRacingResultsForEvents(eventIds);
}

/** Sync recently-started tracked races (Events page / settlement backfill). */
export async function syncRecentTrackedRacingResults(): Promise<RacingSyncResult> {
  const now = Date.now();
  const openBetEventIds = new Set(
    db
      .select({ eventId: bets.eventId })
      .from(bets)
      .where(eq(bets.status, "open"))
      .all()
      .map((b) => b.eventId)
      .filter((id): id is number => id != null)
  );

  const ids = db
    .select()
    .from(events)
    .all()
    .filter(
      (e) =>
        eventInRacingSyncWindow(e, now) &&
        (openBetEventIds.has(e.id) || e.source === "api")
    )
    .map((e) => e.id);

  if (ids.length === 0) return { updated: 0, pending: 0, settledLabels: [] };
  return syncRacingResultsForEvents(ids);
}
