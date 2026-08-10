/** In-play / race-off helpers for Racing Desk (client + server safe). */

/** Keep the racecard after advertised off while horses load / false starts settle. */
export const RACE_OFF_INTERSTITIAL_GRACE_MS = 60_000;

/** Show "Off in m:ss" when advertised off is this close. */
export const RACE_OFF_COUNTDOWN_MS = 5 * 60_000;

/**
 * Switch the desk from a coarse browse tick to a 1s clock once the race is
 * inside the countdown window, plus one coarse bucket so "Off in 5:00" is
 * never painted from a 30s-quantised `now` (which would stick until the next
 * coarse roll).
 */
export function needsRaceOffFineClock(
  startTime: number,
  coarseNow: number,
  coarseRefreshMs: number
): boolean {
  return startTime - coarseNow <= RACE_OFF_COUNTDOWN_MS + coarseRefreshMs;
}

/** True while the live "Off in" countdown label should show. */
export function isWithinRaceOffCountdown(startTime: number, now: number): boolean {
  return startTime - now <= RACE_OFF_COUNTDOWN_MS && startTime > now;
}

/** Normalise provider race_status for comparison (OFF, DELAYED, WEIGHED IN, …). */
export function normalizeRaceApiStatus(raw?: string | null): string {
  return (raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Still before the off (or delayed) — show the racecard, not the interstitial.
 * Includes Betfair-style parade statuses when a feed supplies them.
 */
const PRE_OFF_API_STATUSES = new Set([
  "DORMANT",
  "DELAYED",
  "PARADING",
  "GOINGDOWN",
  "GOINGBEHIND",
  "ATTHEPOST",
  "UNDERORDERS",
  "FALSESTART",
]);

/** Officially off / running (Betfair-style). */
const OFF_API_STATUSES = new Set(["OFF"]);

/**
 * Post-race provider signals (result path handles finished cards).
 * The Racing API commonly uses `result`; Betfair-style feeds use weighed-in, etc.
 */
const POST_RACE_API_STATUSES = new Set([
  "FINISHED",
  "PHOTOGRAPH",
  "RESULT",
  "WEIGHEDIN",
  "RACEVOID",
  "NORACE",
  "ABANDONED",
  "MEETINGABANDONED",
  "RERUN",
]);

export type DeskRaceInPlayInput = {
  status: string;
  startTime: number;
  abandoned?: boolean;
  raceStatus?: string;
  winner?: string;
  runners?: { finishingPosition?: number }[];
};

function raceHasResult(race: DeskRaceInPlayInput): boolean {
  if (race.winner) return true;
  return (race.runners ?? []).some((r) => (r.finishingPosition ?? 0) > 0);
}

/** True when the provider still reports a pre-off / delayed parade state. */
export function isDeskRaceStatusPreOff(raceStatus?: string | null): boolean {
  return PRE_OFF_API_STATUSES.has(normalizeRaceApiStatus(raceStatus));
}

/** Advertised off has passed but the interstitial grace window is still open. */
export function isWithinRaceOffGrace(
  startTime: number,
  now = Date.now(),
  graceMs = RACE_OFF_INTERSTITIAL_GRACE_MS
): boolean {
  return now >= startTime && now < startTime + graceMs;
}

export type RaceOffClock = {
  phase: "countdown" | "elapsed";
  /** Unsigned clock, e.g. `2:05` or `1:02:03`. */
  clock: string;
  /** Signed clock, e.g. `−2:05` or `+1:12`. */
  signed: string;
};

function formatClockParts(totalMs: number): string {
  const totalSec = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Live countdown to advertised off, or red elapsed up-count after it. */
export function formatRaceOffClock(startTime: number, now = Date.now()): RaceOffClock {
  const delta = now - startTime;
  const phase: RaceOffClock["phase"] = delta < 0 ? "countdown" : "elapsed";
  const clock = formatClockParts(Math.abs(delta));
  // U+2212 minus sign keeps tabular width closer to plus.
  const signed = phase === "countdown" ? `\u2212${clock}` : `+${clock}`;
  return { phase, clock, signed };
}

/**
 * True when the selected race should show the dismissible in-play interstitial:
 * past advertised off (+ grace) or provider OFF, no result yet, not abandoned / delayed.
 */
export function isDeskRaceInPlay(
  race: DeskRaceInPlayInput,
  now = Date.now()
): boolean {
  if (race.abandoned) return false;
  if (raceHasResult(race)) return false;

  const api = normalizeRaceApiStatus(race.raceStatus);
  if (api) {
    if (PRE_OFF_API_STATUSES.has(api)) return false;
    if (POST_RACE_API_STATUSES.has(api)) return false;
    // Firm provider OFF skips the grace window.
    if (OFF_API_STATUSES.has(api)) return true;
    // Other provider values (e.g. Racing API `declared`) fall through to the clock.
  }

  const pastAdvertised = race.status === "live" || race.startTime <= now;
  if (!pastAdvertised) return false;
  return now >= race.startTime + RACE_OFF_INTERSTITIAL_GRACE_MS;
}
