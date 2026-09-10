/** Detect a tape goal from a live score tick. First paint is never a goal. */

export type TapeGoalFlash = { home: boolean; away: boolean };

export function tapeGoalFromScoreDelta(
  prev: { home: number; away: number } | null,
  next: { home: number; away: number }
): TapeGoalFlash | null {
  if (!prev) return null;
  const dHome = next.home - prev.home;
  const dAway = next.away - prev.away;
  if (dHome <= 0 && dAway <= 0) return null;
  return { home: dHome > 0, away: dAway > 0 };
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
