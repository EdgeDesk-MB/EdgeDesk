/**
 * Pure decision rules for football live polling. Scores refresh every
 * LIVE_TTL_MS. Tape is a second request: fetch on score or period change,
 * or when the stored tape is older than TAPE_REFRESH_MS. Missed matches
 * still get one result / tape backfill after the live window.
 */

/** In-process live-score / tape cache, and the fixtures-board live poll. */
export const LIVE_TTL_MS = 15 * 1000;

/** Live polling covers kickoff-imminent through 4h after kickoff. */
export const LIVE_POLL_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Backfill gives up after 3 days - beyond that, correct manually. */
export const RESULT_BACKFILL_MAX_AGE_MS = 72 * 60 * 60 * 1000;

/**
 * Cards and subs arrive without a score change. 30s keeps the tape moving
 * without doubling every live-score poll. Six tracked live matches for two
 * hours is ~1,440 tape requests; plus ~1,920 `live=all` on a busy Saturday.
 */
export const TAPE_REFRESH_MS = 30 * 1000;

/**
 * Match-view modal poll. Provider tape is cached at 15s, so this spends a
 * request at most that often while the dialog is open.
 * `/api/state` is paused for every dialog, so this is the live path for
 * new commentary rows.
 */
export const MATCH_VIEW_TAPE_POLL_MS = 15 * 1000;

/** Confirmed XI: fetch once when kick-off is close, or the match has started. */
export const LINEUPS_AHEAD_MS = 2 * 60 * 60 * 1000;

/**
 * The event tape is a second request. Fetch when the score or period moved,
 * when a live match has no stored tape yet, or when the last tape is older
 * than {@link TAPE_REFRESH_MS}.
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
  now = Date.now(),
  mode: "live" | "critical" = "live"
): boolean {
  if (fixture.status === "upcoming") return false;
  const scoreChanged =
    fixture.homeScore !== event.homeScore || fixture.awayScore !== event.awayScore;
  const periodChanged =
    fixture.period != null && fixture.period !== (event.period ?? null);
  const noTimelineYet = !event.goals || event.goals === "[]";
  if (scoreChanged || periodChanged || noTimelineYet) return true;
  if (mode === "critical") return false;
  const stale =
    fixture.status === "live" &&
    event.tapeFetchedAt != null &&
    now - event.tapeFetchedAt >= TAPE_REFRESH_MS;
  return stale;
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

/** Keep fetching tape while the match view is open on a live (or imminent) row. */
export function matchViewShouldPollTape(
  status: string,
  startTime: number | undefined,
  now = Date.now()
): boolean {
  if (status === "live") return true;
  return (
    status === "upcoming" &&
    startTime != null &&
    startTime <= now + 5 * 60 * 1000
  );
}
