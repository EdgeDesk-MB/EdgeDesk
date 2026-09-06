/**
 * Pure decision rules for football live polling. The free API tier allows
 * ~100 requests/day, and a live match already costs one per minute - these
 * rules keep the second (timeline) request rare and give missed matches a
 * cheap way to their final result.
 */

/** Live polling covers kickoff-imminent through 4h after kickoff. */
export const LIVE_POLL_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Backfill gives up after 3 days - beyond that, correct manually. */
export const RESULT_BACKFILL_MAX_AGE_MS = 72 * 60 * 60 * 1000;

/** Cards and subs arrive without a score change; refresh live tape on this cadence. */
export const TAPE_REFRESH_MS = 5 * 60 * 1000;

/** Confirmed XI: fetch once when kick-off is close, or the match has started. */
export const LINEUPS_AHEAD_MS = 2 * 60 * 60 * 1000;

/**
 * The event tape is a SECOND request per poll (it once drained the whole
 * daily budget by half-time). Fetch when the score or period moved, when a
 * live match has no stored tape yet, or when the last tape is older than
 * {@link TAPE_REFRESH_MS}.
 */
export function shouldFetchGoalTimeline(
  event: {
    goals: string | null;
    homeScore: number;
    awayScore: number;
    period?: string | null;
    tapeFetchedAt?: number | null;
  },
  fixture: {
    status: string;
    homeScore: number;
    awayScore: number;
    period?: string | null;
  },
  now = Date.now()
): boolean {
  if (fixture.status === "upcoming") return false;
  const scoreChanged =
    fixture.homeScore !== event.homeScore || fixture.awayScore !== event.awayScore;
  const periodChanged =
    fixture.period != null && fixture.period !== (event.period ?? null);
  const noTimelineYet = !event.goals || event.goals === "[]";
  const stale =
    fixture.status === "live" &&
    event.tapeFetchedAt != null &&
    now - event.tapeFetchedAt >= TAPE_REFRESH_MS;
  return scoreChanged || periodChanged || noTimelineYet || stale;
}

export function shouldFetchLineups(
  event: { lineups: string | null; startTime: number },
  fixture: { status: string },
  now = Date.now()
): boolean {
  if (event.lineups && event.lineups !== "{}" && event.lineups !== "[]") {
    return false;
  }
  if (fixture.status === "live" || fixture.status === "finished") return true;
  return event.startTime <= now + LINEUPS_AHEAD_MS;
}

/**
 * An api football match that never reached "finished" inside the live window
 * (budget ran dry, server was closed, …) deserves one result fetch so the
 * final score lands instead of freezing at the last polled minute.
 */
export function needsResultBackfill(
  event: {
    sport: string | null;
    source: string | null;
    externalId: string | null;
    status: string;
    startTime: number;
  },
  now: number
): boolean {
  if ((event.sport ?? "football") !== "football") return false;
  if (event.source !== "api" || !event.externalId) return false;
  if (event.status === "finished") return false;
  const age = now - event.startTime;
  return age > LIVE_POLL_WINDOW_MS && age <= RESULT_BACKFILL_MAX_AGE_MS;
}

/**
 * Finished api matches leave the live poll, so a row can have a final
 * score and still hold an empty `goals` tape (score backfill, missed
 * live window, or the tape request failed). One more events fetch fills
 * the modal. Give up after {@link RESULT_BACKFILL_MAX_AGE_MS}.
 */
export function needsTapeBackfill(
  event: {
    sport: string | null;
    source: string | null;
    externalId: string | null;
    status: string;
    startTime: number;
    goals: string | null;
  },
  now: number
): boolean {
  if ((event.sport ?? "football") !== "football") return false;
  if (event.source !== "api" || !event.externalId) return false;
  if (event.status !== "finished") return false;
  if (event.goals && event.goals !== "[]") return false;
  const age = now - event.startTime;
  return age >= 0 && age <= RESULT_BACKFILL_MAX_AGE_MS;
}
