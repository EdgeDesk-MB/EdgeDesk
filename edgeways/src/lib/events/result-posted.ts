/**
 * When the provider posts a finished result. 90' and the last goal are not
 * the end: added time and extra time can still change the match. Final bets
 * wait for FT / AET / PEN (or a race result). In-play rows stay on the tape.
 */
import { lastMatchTapeMinute } from "@/lib/history-match-clock";

export const EXTRA_TIME_PERIODS = new Set(["ET", "BT", "P"]);

const CATCH_UP_POLL_MS = 30 * 60 * 1000;
const WATCH_AFTER_FT_MS = 15 * 60 * 1000;

export function isExtraTimePeriod(period: string | null | undefined): boolean {
  return period != null && EXTRA_TIME_PERIODS.has(period);
}

export function lastInPlayOccurredAt(event: {
  startTime: number;
  goals?: string | null;
  minute?: number | null;
}): number {
  const last = lastMatchTapeMinute(event.goals);
  const stored = event.minute != null && event.minute > 0 ? event.minute : 0;
  const minute = Math.max(last ?? 0, stored);
  const at = event.startTime + minute * 60_000;
  return last != null ? at + 1000 : at;
}

/**
 * Wall-clock of the posted result. Always after the last in-play moment so a
 * 94' goal cannot sit above full time. A morning catch-up poll is not the end.
 */
export function stampResultPostedAt(input: {
  previousStatus: string;
  previousPostedAt?: number | null;
  startTime: number;
  goals?: string | null;
  minute?: number | null;
  now: number;
  incomingStatus: string;
  incomingPeriod?: string | null;
}): number | null {
  if (input.incomingStatus === "live" && isExtraTimePeriod(input.incomingPeriod)) {
    return null;
  }
  if (input.incomingStatus !== "finished") {
    return input.previousPostedAt ?? null;
  }
  if (input.previousPostedAt != null && input.previousPostedAt > 0) {
    return input.previousPostedAt;
  }
  const afterInPlay = lastInPlayOccurredAt(input);
  if (input.previousStatus === "live") {
    return Math.max(input.now, afterInPlay);
  }
  if (input.now > afterInPlay + CATCH_UP_POLL_MS) return afterInPlay;
  return Math.max(input.now, afterInPlay);
}

export function eventResultPostedAt(event: {
  sport?: string | null;
  status?: string | null;
  startTime: number;
  goals?: string | null;
  minute?: number | null;
  resultPostedAt?: number | null;
}): number | null {
  if (event.status !== "finished") return null;
  if (event.sport === "horse_racing") {
    return event.resultPostedAt ?? event.startTime;
  }
  const afterInPlay = lastInPlayOccurredAt(event);
  if (event.resultPostedAt != null && event.resultPostedAt > 0) {
    return Math.max(event.resultPostedAt, afterInPlay);
  }
  return afterInPlay;
}

/** Keep polling a just-posted FT briefly: cups can still go to extra time. */
export function stillWatchingAfterWhistle(
  event: {
    status: string;
    matchEnding?: string | null;
    resultPostedAt?: number | null;
    startTime: number;
  },
  now: number
): boolean {
  if (event.status !== "finished") return false;
  if (event.matchEnding === "aet" || event.matchEnding === "pen") return false;
  if (event.resultPostedAt == null) return false;
  return now - event.resultPostedAt < WATCH_AFTER_FT_MS;
}
