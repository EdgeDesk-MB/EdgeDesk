/**
 * Pull race results from The Racing API for tracked events missing (or incomplete) `goals`.
 */
import { eq } from "drizzle-orm";
import { db, bets, events, type EventRow } from "@/lib/db";
import { formatRacingEventTitle, localCalendarDate } from "@/lib/events";
import {
  isRaceResultIncomplete,
  parseRaceResults,
  serializeRaceResults,
  withPreservedRaceDisplayMeta,
} from "@/lib/racing";
import {
  clearRacingResultsCache,
  getCachedRacingResultsTier,
  hasRacingApiKey,
  resultsForRaceIds,
  RESULTS_TTL_ACTIVE,
  type RacingResultsTier,
} from "@/lib/services/theracingapi";

export interface RacingSyncResult {
  updated: number;
  pending: number;
  settledLabels: string[];
  /** True when credentials exist but Free tier blocks `/v1/results/today`. */
  tierBlocked: boolean;
  /** True when a previous day's `/v1/results` needs Standard. */
  historicBlocked: boolean;
  tier: RacingResultsTier;
}

export interface SyncRacingOptions {
  /**
   * Re-fetch even when a result already exists (overwrite winner-only / wrong placings).
   * Also skips the 6-hour sync window so older races can be corrected.
   */
  force?: boolean;
  /** Bypass the results cache (manual Fetch results). */
  skipCache?: boolean;
  /** Open bets keep polling for 36 hours so overnight results still land. */
  includeOpenBets?: boolean;
}

function emptySync(tier: RacingResultsTier = getCachedRacingResultsTier()): RacingSyncResult {
  return {
    updated: 0,
    pending: 0,
    settledLabels: [],
    tierBlocked: tier === "free",
    historicBlocked: false,
    tier,
  };
}

/** Missing result, or winner-only (manual Set winner) - needs full API placings. */
export function eventNeedsRaceResult(event: EventRow, force = false): boolean {
  if (event.sport !== "horse_racing" || !event.externalId?.trim()) return false;
  if (force) return true;
  const parsed = parseRaceResults(event.goals);
  if (!parsed) return true;
  return isRaceResultIncomplete(parsed);
}

/** True when the race should have started - autopilot polls these windows. */
export function eventInRacingSyncWindow(
  event: EventRow,
  now = Date.now(),
  force = false,
  includeOpenBets = false
): boolean {
  if (!eventNeedsRaceResult(event, force)) return false;
  const lookbackMs =
    force || includeOpenBets ? 36 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
  return event.startTime <= now + 2 * 60 * 1000 && event.startTime > now - lookbackMs;
}

/** Fetch API results for the given events (or all pending if omitted). */
export async function syncRacingResultsForEvents(
  eventIds?: number[],
  options: SyncRacingOptions = {}
): Promise<RacingSyncResult> {
  if (!hasRacingApiKey()) return emptySync("none");

  const { force = false, skipCache = false, includeOpenBets = false } = options;
  if (skipCache || force) clearRacingResultsCache();

  const now = Date.now();
  const idSet = eventIds ? new Set(eventIds) : null;

  const candidates = db
    .select()
    .from(events)
    .all()
    .filter((e) => {
      if (!eventNeedsRaceResult(e, force)) return false;
      if (idSet && !idSet.has(e.id)) return false;
      if (!eventInRacingSyncWindow(e, now, force, includeOpenBets)) return false;
      return true;
    });

  if (candidates.length === 0) return emptySync();

  let updated = 0;
  let pending = 0;
  const settledLabels: string[] = [];

  try {
    const dateByRaceId: Record<string, string> = {};
    for (const event of candidates) {
      if (event.externalId) {
        dateByRaceId[event.externalId] = localCalendarDate(new Date(event.startTime));
      }
    }
    // Prefer a fresher cache when settling open / incomplete races (fast results).
    const { results, tierBlocked, tier, historicBlocked } = await resultsForRaceIds(
      candidates.map((e) => e.externalId!),
      { maxStaleMs: RESULTS_TTL_ACTIVE, dateByRaceId }
    );

    if (tierBlocked) {
      return {
        updated: 0,
        pending: candidates.length,
        settledLabels: [],
        tierBlocked: true,
        historicBlocked: false,
        tier,
      };
    }

    for (const event of candidates) {
      const result = results.get(event.externalId!);
      if (!result) {
        pending += 1;
        if (event.startTime <= now && event.status === "upcoming") {
          db.update(events).set({ status: "live" }).where(eq(events.id, event.id)).run();
        }
        continue;
      }
      // Don't overwrite a complete result with a thinner API payload unless forced
      const existing = parseRaceResults(event.goals);
      if (
        !force &&
        existing &&
        !isRaceResultIncomplete(existing) &&
        isRaceResultIncomplete(result)
      ) {
        continue;
      }
      db.update(events)
        .set({
          status: "finished",
          goals: serializeRaceResults(
            withPreservedRaceDisplayMeta(result, event.goals)
          ),
          homeScore: 1,
          awayScore: 0,
        })
        .where(eq(events.id, event.id))
        .run();
      updated += 1;
      settledLabels.push(formatRacingEventTitle(event));
    }

    return {
      updated,
      pending,
      settledLabels,
      tierBlocked: false,
      historicBlocked: Boolean(historicBlocked),
      tier,
    };
  } catch {
    return {
      updated: 0,
      pending: candidates.length,
      settledLabels: [],
      tierBlocked: false,
      historicBlocked: false,
      tier: getCachedRacingResultsTier(),
    };
  }
}

/** Sync results for every horse-racing event linked to an open bet or desk leg. */
export async function syncRacingResultsForOpenBets(
  extraEventIds: Iterable<number> = []
): Promise<RacingSyncResult> {
  const eventIds = [
    ...new Set([
      ...db
        .select({ eventId: bets.eventId })
        .from(bets)
        .where(eq(bets.status, "open"))
        .all()
        .map((b) => b.eventId)
        .filter((id): id is number => id != null),
      ...extraEventIds,
    ]),
  ];
  if (eventIds.length === 0) return emptySync();
  return syncRacingResultsForEvents(eventIds, { includeOpenBets: true });
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

  if (ids.length === 0) return emptySync();
  return syncRacingResultsForEvents(ids);
}
