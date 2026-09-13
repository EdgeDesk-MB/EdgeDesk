/** Detect a tape goal from a live score tick. Never flash both sides. */

import {
  parseMatchTape,
  standingTapeGoals,
  tapeElapsed,
  type MatchTapeEvent,
} from "@/lib/events/match-tape";

export type TapeGoalFlash = { home: boolean; away: boolean };

export type TapeLastGoal = { side: "home" | "away"; minute: number };

export type TapeLastGoalHint = {
  lastGoalSide?: "home" | "away" | null;
  lastGoalMinute?: number | null;
};

export function exclusiveTapeGoal(side: "home" | "away"): TapeGoalFlash {
  return { home: side === "home", away: side === "away" };
}

/**
 * Last standing goal, but only when the tape's running score matches the
 * published board. A short tape (live=all lag) must not name the previous
 * scorer as the latest.
 */
export function lastStandingGoalMatchingScore(
  events: MatchTapeEvent[],
  score: { home: number; away: number }
): TapeLastGoal | null {
  const standing = standingTapeGoals(events);
  let home = 0;
  let away = 0;
  for (const goal of standing) {
    if (goal.side === "home") home += 1;
    else away += 1;
  }
  if (home !== score.home || away !== score.away) return null;
  const last = standing.at(-1);
  if (!last) return null;
  return { side: last.side, minute: tapeElapsed(last) };
}

export function lastGoalFromHint(hint?: TapeLastGoalHint | null): TapeLastGoal | null {
  if (!hint) return null;
  if (hint.lastGoalSide !== "home" && hint.lastGoalSide !== "away") return null;
  if (hint.lastGoalMinute == null || !Number.isFinite(hint.lastGoalMinute)) return null;
  return { side: hint.lastGoalSide, minute: hint.lastGoalMinute };
}

/** Prefer a tracked tape that matches the board, then the live-list hint. */
export function resolveTapeLastGoal(
  score: { home: number; away: number },
  trackedTape?: MatchTapeEvent[] | string | null,
  hint?: TapeLastGoalHint | null
): TapeLastGoal | null {
  const events =
    typeof trackedTape === "string" ? parseMatchTape(trackedTape) : (trackedTape ?? []);
  return lastStandingGoalMatchingScore(events, score) ?? lastGoalFromHint(hint);
}

/**
 * One side only. A poll that skipped both teams' goals uses the last standing
 * goal when we have it; otherwise it stays quiet rather than flashing both.
 */
export function tapeGoalFromScoreDelta(
  prev: { home: number; away: number } | null,
  next: { home: number; away: number },
  lastSide?: "home" | "away" | null
): TapeGoalFlash | null {
  if (!prev) return null;
  const dHome = next.home - prev.home;
  const dAway = next.away - prev.away;
  if (dHome <= 0 && dAway <= 0) return null;
  if (dHome > 0 && dAway > 0) {
    if (lastSide === "home" || lastSide === "away") return exclusiveTapeGoal(lastSide);
    return null;
  }
  return { home: dHome > 0, away: dAway > 0 };
}

/**
 * First paint / tape catch-up: the latest goal, and only if it is on the
 * current elapsed minute. Older goals must not flash on a reload.
 */
export function tapeGoalFromLatestEvent(
  last: TapeLastGoal | null | undefined,
  matchMinute: number | null | undefined
): TapeGoalFlash | null {
  if (!last) return null;
  if (matchMinute == null || !Number.isFinite(matchMinute)) return null;
  if (last.minute !== matchMinute) return null;
  return exclusiveTapeGoal(last.side);
}

export function tapeGoalFromLastSideChange(
  prevSide: "home" | "away" | null | undefined,
  next: TapeLastGoal | null | undefined,
  matchMinute: number | null | undefined
): TapeGoalFlash | null {
  if (!next || next.side === prevSide) return null;
  return tapeGoalFromLatestEvent(next, matchMinute);
}

/** Goal mark and gold cell stay up for 20 seconds. */
export const TAPE_GOAL_FLASH_MS = 20_000;

/** Localhost only. Open `/fixtures?previewGoal=1` to bump the first live home. */
export const TAPE_GOAL_PREVIEW_PARAM = "previewGoal";

export function tapeGoalPreviewRequested(
  hostname: string,
  search: string
): boolean {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
  return new URLSearchParams(search).get(TAPE_GOAL_PREVIEW_PARAM) === "1";
}

export function bumpTapeGoalPreviewHome<T extends { homeScore?: number | null }>(
  fixture: T
): T {
  return { ...fixture, homeScore: (fixture.homeScore ?? 0) + 1 };
}
