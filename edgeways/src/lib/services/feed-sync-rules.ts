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
import { LIVE_POLL_WINDOW_MS, needsResultBackfill } from "@/lib/live-poll-rules";
import {
  isRaceResultIncomplete,
  parseRaceResults,
  serializeRaceResults,
  withPreservedRaceDisplayMeta,
  type RaceResult,
} from "@/lib/racing";

/** Football events inside the live window: kickoff imminent or recently passed. */
export function isFootballLivePollCandidate(
  event: Pick<EventRow, "sport" | "externalId" | "status" | "startTime" | "source">,
  now: number
): boolean {
  return (
    event.source === "api" &&
    (event.sport ?? "football") === "football" &&
    Boolean(event.externalId) &&
    event.status !== "finished" &&
    event.startTime < now + 5 * 60 * 1000 &&
    event.startTime > now - LIVE_POLL_WINDOW_MS
  );
}

/**
 * Which football events this poll should fetch. Same split as the local path:
 * the live window plus one cheap result backfill for matches that never
 * reached "finished" (budget ran dry, no traffic on the hosted desk).
 */
export function selectFootballSyncEvents<
  T extends Pick<EventRow, "id" | "sport" | "externalId" | "status" | "startTime" | "source">,
>(
  rows: T[],
  now: number,
  backfillAttempted: ReadonlySet<number>
): { poll: T[]; backfill: T[] } {
  const poll = rows.filter((e) => isFootballLivePollCandidate(e, now));
  const pollIds = new Set(poll.map((e) => e.id));
  const backfill = rows.filter(
    (e) => !pollIds.has(e.id) && needsResultBackfill(e, now) && !backfillAttempted.has(e.id)
  );
  return { poll, backfill };
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
  event: Pick<EventRow, "homeLed2" | "awayLed2">,
  fixture: Fixture,
  goals: string | null,
  extras?: {
    lineups?: string | null;
    tapeFetchedAt?: number | null;
  }
): NeonEventFeedPatch {
  return {
    status: fixture.status,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    minute: fixture.minute,
    period: fixture.period ?? null,
    homeLed2: event.homeLed2 || (fixture.homeScore - fixture.awayScore >= 2 ? 1 : 0),
    awayLed2: event.awayLed2 || (fixture.awayScore - fixture.homeScore >= 2 ? 1 : 0),
    goals,
    ...(typeof fixture.htHomeScore === "number" || typeof fixture.htAwayScore === "number"
      ? {
          htHomeScore: fixture.htHomeScore ?? null,
          htAwayScore: fixture.htAwayScore ?? null,
        }
      : {}),
    ...(extras?.lineups !== undefined ? { lineups: extras.lineups } : {}),
    ...(extras?.tapeFetchedAt !== undefined ? { tapeFetchedAt: extras.tapeFetchedAt } : {}),
    ...(fixture.matchEnding != null
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
  event: Pick<EventRow, "goals">,
  result: RaceResult,
  force = false
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
  };
}
