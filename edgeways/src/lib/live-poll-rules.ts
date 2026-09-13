/**
 * Pure decision rules for football live polling. Scores refresh every
 * LIVE_TTL_MS. Tape is a second request: fetch on score or period change,
 * or when the stored tape is older than TAPE_REFRESH_MS. Missed matches
 * still get one result / tape backfill after the live window.
 */

import { isExtraTimePeriod } from "@/lib/events/result-posted";

/** In-process live-score / tape cache, and the fixtures-board live poll. */
export const LIVE_TTL_MS = 15 * 1000;

/** Live polling covers kickoff-imminent through 4h after kickoff. */
export const LIVE_POLL_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * `live=all` can keep a match listed with a frozen minute (Bolton 57' 0-0
 * after FT). Once wall-clock playing time is this far ahead of the reported
 * minute, prefer `/fixtures?id=` and the day store.
 */
export const LIVE_CLOCK_STALE_SLACK_MS = 10 * 60 * 1000;

/** 15 min HT plus a little stoppage before wall-clock is treated as 2H. */
const HALF_TIME_ALLOWANCE_MS = 18 * 60 * 1000;

/** League 90 + HT + added time. Past this without ET, FT is overdue. */
export const LIVE_FT_OVERDUE_MS = 2 * 60 * 60 * 1000 + 10 * 60 * 1000;

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
    status?: string;
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
  if (
    event.status === "finished" &&
    fixture.status !== "finished" &&
    !isExtraTimePeriod(fixture.period)
  ) {
    return false;
  }
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

/** True when wall-clock says this live=all row is frozen behind the match. */
export function liveFixtureClockIsStale(
  fixture: {
    status: string;
    startTime: number;
    minute?: number | null;
    period?: string | null;
  },
  now = Date.now()
): boolean {
  if (fixture.status !== "live") return false;
  if (isExtraTimePeriod(fixture.period)) return false;
  const wall = now - fixture.startTime;
  if (wall <= 0) return false;
  if (wall >= LIVE_FT_OVERDUE_MS) return true;
  const reportedMs = Math.max(0, fixture.minute ?? 0) * 60_000;
  const inSecondHalf =
    (fixture.minute ?? 0) >= 45 ||
    fixture.period === "HT" ||
    fixture.period === "2H";
  const expectedPlayingMs = Math.max(
    0,
    wall - (inSecondHalf ? HALF_TIME_ALLOWANCE_MS : 0)
  );
  return expectedPlayingMs - reportedMs > LIVE_CLOCK_STALE_SLACK_MS;
}

/** False when a live=all row must not be used as the tracked-event score. */
export function liveSnapshotUsable(
  fixture: {
    status: string;
    startTime: number;
    minute?: number | null;
    period?: string | null;
  },
  now = Date.now()
): boolean {
  if (fixture.status === "finished") return true;
  if (fixture.status !== "live") return true;
  return !liveFixtureClockIsStale(fixture, now);
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

/**
 * The fixtures board polls today for live scores. Any earlier day in the
 * lookback window polls only while a card is still open: FT never appears
 * on `live=all`, so the day store must be re-read after catch-up writes
 * through. Tomorrow is store-only.
 */
export function footballBoardShouldPollDay(
  day: string,
  today: string,
  fixtures: readonly { status: string }[]
): boolean {
  if (day === today) return true;
  if (day > today) return false;
  return fixtures.some((fixture) => fixture.status !== "finished");
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
