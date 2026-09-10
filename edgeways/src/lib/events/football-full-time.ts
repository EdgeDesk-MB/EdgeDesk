/**
 * Football bets in Edgeways are 90-minute / full-time markets.
 * Extra time and penalties may change the match, but they do not settle
 * these bets. ET-inclusive markets can be added later as their own types.
 */
import { tapeGoals } from "@/lib/events/match-tape";
import type { GoalEvent } from "@/lib/calc";

export function footballHasStoredNinetyMinuteScore(event: {
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
}): boolean {
  return event.ftHomeScore != null && event.ftAwayScore != null;
}

/** 90-minute score. Never the AET / pens line. */
export function footballNinetyMinuteScore(event: {
  homeScore: number;
  awayScore: number;
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
}): { home: number; away: number } {
  if (footballHasStoredNinetyMinuteScore(event)) {
    return { home: event.ftHomeScore!, away: event.ftAwayScore! };
  }
  return { home: event.homeScore, away: event.awayScore };
}

/**
 * Goals that make the 90-minute score. Stops at the FT scoreline so extra-time
 * kicks are ignored when `ftHomeScore` / `ftAwayScore` are stored.
 */
export function footballNinetyMinuteGoals(event: {
  goals?: string | null;
  homeScore: number;
  awayScore: number;
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
}): GoalEvent[] {
  const goals = tapeGoals(event.goals);
  if (!footballHasStoredNinetyMinuteScore(event)) return goals;
  const ft = footballNinetyMinuteScore(event);
  let home = 0;
  let away = 0;
  const out: GoalEvent[] = [];
  for (const goal of goals) {
    if (goal.side === "home") home += 1;
    else away += 1;
    out.push(goal);
    if (home === ft.home && away === ft.away) break;
  }
  return out;
}

/**
 * Final 90-minute result is posted. AET / pens without a stored FT score
 * stay open so we never settle on the extra-time line.
 */
export function footballFtResultReady(event: {
  sport?: string | null;
  status?: string | null;
  matchEnding?: string | null;
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
}): boolean {
  if ((event.sport ?? "football") === "horse_racing") return false;
  if (event.status !== "finished") return false;
  if (event.matchEnding === "aet" || event.matchEnding === "pen") {
    return footballHasStoredNinetyMinuteScore(event);
  }
  return true;
}
