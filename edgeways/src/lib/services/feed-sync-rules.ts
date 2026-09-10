/**
 * Pure decision + patch rules for the hosted feed poller (EDGE-81b).
 *
 * These mirror the write bodies inside `refreshApiEvents()` and
 * `syncRacingResultsForEvents()` (services/state.ts, services/sync-racing-results.ts)
 * field for field, extracted so the Neon poller can apply the identical
 * semantics and so that "same field semantics as the local path" is testable.
 *
 * The local SQLite path is deliberately left untouched: it keeps its inline
 * writes. If either side changes, `feed-sync-rules.test.ts` is the guard.
 */
import type { Fixture } from "@/lib/services/apifootball";
import type { NeonEventFeedPatch } from "@/lib/db/neon-events";
import type { EventRow } from "@/lib/db/schema";
import {
  isExtraTimePeriod,
  stampResultPostedAt,
  stillWatchingAfterWhistle,
} from "@/lib/events/result-posted";
import {
  LIVE_POLL_WINDOW_MS,
  needsResultBackfill,
  needsTapeBackfill,
} from "@/lib/live-poll-rules";
import {
  isRaceResultIncomplete,
  parseRaceResults,
  serializeRaceResults,
  withPreservedRaceDisplayMeta,
  type RaceResult,
} from "@/lib/racing";

/** Football events inside the live window: kickoff imminent or recently passed. */
export function isFootballLivePollCandidate(
  event: Pick<
    EventRow,
    | "sport"
    | "externalId"
    | "status"
    | "startTime"
    | "source"
    | "matchEnding"
    | "resultPostedAt"
  >,
  now: number
): boolean {
  if (event.source !== "api") return false;
  if ((event.sport ?? "football") !== "football") return false;
  if (!event.externalId) return false;
  if (event.startTime >= now + 5 * 60 * 1000) return false;
  if (event.startTime <= now - LIVE_POLL_WINDOW_MS) return false;
  if (event.status !== "finished") return true;
  return stillWatchingAfterWhistle(event, now);
}

/**
 * Which football events this poll should fetch. Same split as the local path:
 * the live window, one cheap result backfill for matches that never
 * reached "finished", and one tape backfill for finished matches whose
 * `goals` column is still empty.
 */
export function selectFootballSyncEvents<
  T extends Pick<
    EventRow,
    "id" | "sport" | "externalId" | "status" | "startTime" | "source" | "goals"
  >,
>(
  rows: T[],
  now: number,
  backfillAttempted: ReadonlySet<number>
): { poll: T[]; backfill: T[] } {
  const poll = rows.filter((e) => isFootballLivePollCandidate(e, now));
  const pollIds = new Set(poll.map((e) => e.id));
  const resultBackfill = rows.filter(
    (e) => !pollIds.has(e.id) && needsResultBackfill(e, now) && !backfillAttempted.has(e.id)
  );
  const resultIds = new Set(resultBackfill.map((e) => e.id));
  const tapeBackfill = rows.filter(
    (e) =>
      !pollIds.has(e.id) &&
      !resultIds.has(e.id) &&
      needsTapeBackfill(e, now) &&
      !backfillAttempted.has(e.id)
  );
  return { poll, backfill: [...resultBackfill, ...tapeBackfill] };
}

/**
 * The event patch for one polled fixture. `goals` is the timeline to store
 * (caller decides whether to spend a second request on it); pass the event's
 * existing value to leave it alone.
 *
 * 2UP flags latch: once a side has led by two they stay set for the rest of the
 * match even if the lead is pegged back.
 */
export function footballEventPatch(
  event: Pick<
    EventRow,
    | "homeLed2"
    | "awayLed2"
    | "status"
    | "startTime"
    | "minute"
    | "homeScore"
    | "awayScore"
    | "ftHomeScore"
    | "ftAwayScore"
    | "resultPostedAt"
  >,
  fixture: Fixture,
  goals: string | null,
  extras?: {
    lineups?: string | null;
    tapeFetchedAt?: number | null;
    now?: number;
  }
): NeonEventFeedPatch {
  const now = extras?.now ?? Date.now();
  const reopenedForExtraTime =
    event.status === "finished" &&
    fixture.status === "live" &&
    isExtraTimePeriod(fixture.period);
  const resultPostedAt = stampResultPostedAt({
    previousStatus: event.status,
    previousPostedAt: event.resultPostedAt,
    startTime: event.startTime,
    goals,
    minute: fixture.minute,
    now,
    incomingStatus: fixture.status,
    incomingPeriod: fixture.period,
  });
  return {
    status: fixture.status,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    minute: fixture.minute,
    period: fixture.period ?? null,
    homeLed2:
      event.homeLed2 ||
      (!reopenedForExtraTime &&
      !isExtraTimePeriod(fixture.period) &&
      fixture.homeScore - fixture.awayScore >= 2
        ? 1
        : 0),
    awayLed2:
      event.awayLed2 ||
      (!reopenedForExtraTime &&
      !isExtraTimePeriod(fixture.period) &&
      fixture.awayScore - fixture.homeScore >= 2
        ? 1
        : 0),
    goals,
    resultPostedAt,
    ...(typeof fixture.htHomeScore === "number" || typeof fixture.htAwayScore === "number"
      ? {
          htHomeScore: fixture.htHomeScore ?? null,
          htAwayScore: fixture.htAwayScore ?? null,
        }
      : {}),
    ...(extras?.lineups !== undefined ? { lineups: extras.lineups } : {}),
    ...(extras?.tapeFetchedAt !== undefined ? { tapeFetchedAt: extras.tapeFetchedAt } : {}),
    ...(reopenedForExtraTime
      ? {
          matchEnding: null,
          ftHomeScore: event.ftHomeScore ?? event.homeScore,
          ftAwayScore: event.ftAwayScore ?? event.awayScore,
        }
      : fixture.matchEnding != null
        ? {
            matchEnding: fixture.matchEnding,
            ftHomeScore: fixture.ftHomeScore ?? null,
            ftAwayScore: fixture.ftAwayScore ?? null,
          }
        : {}),
  };
}

/**
 * The event patch for one race result, or null when the stored result is
 * already better than the payload (never downgrade a full result to
 * winner-only unless forced).
 */
export function racingResultPatch(
  event: Pick<EventRow, "goals" | "resultPostedAt">,
  result: RaceResult,
  force = false,
  now = Date.now()
): NeonEventFeedPatch | null {
  const existing = parseRaceResults(event.goals);
  if (!force && existing && !isRaceResultIncomplete(existing) && isRaceResultIncomplete(result)) {
    return null;
  }
  return {
    status: "finished",
    goals: serializeRaceResults(withPreservedRaceDisplayMeta(result, event.goals)),
    homeScore: 1,
    awayScore: 0,
    resultPostedAt: event.resultPostedAt ?? now,
  };
}
