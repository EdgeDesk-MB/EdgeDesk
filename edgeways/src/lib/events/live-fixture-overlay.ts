import { isExtraTimePeriod } from "@/lib/events/result-posted";

/** In-play scores overlaid on the football day-card. Never written back. */

export type LiveScoreFields = {
  externalId?: string | null;
  status: "upcoming" | "live" | "finished" | string;
  homeScore: number;
  awayScore: number;
  minute?: number | null;
  period?: string | null;
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  ftHomeScore?: number | null;
  ftAwayScore?: number | null;
  matchEnding?: string | null;
};

function goals(row: LiveScoreFields): number {
  return (row.homeScore ?? 0) + (row.awayScore ?? 0);
}

/** Prefer the row that has actually moved on. Never replace 2-1 with 0-0. */
export function preferFresherLiveScore<T extends LiveScoreFields>(
  current: T,
  incoming: T
): T {
  if (
    current.status === "finished" &&
    incoming.status !== "finished" &&
    !isExtraTimePeriod(incoming.period)
  ) {
    return current;
  }
  if (incoming.status === "finished" && current.status !== "finished") return incoming;
  const currentGoals = goals(current);
  const incomingGoals = goals(incoming);
  if (incomingGoals !== currentGoals) return incomingGoals > currentGoals ? incoming : current;
  const currentMinute = current.minute ?? 0;
  const incomingMinute = incoming.minute ?? 0;
  if (incomingMinute !== currentMinute) {
    return incomingMinute > currentMinute ? incoming : current;
  }
  if (incoming.status === "live" && current.status !== "live") return incoming;
  return current;
}

function scorePatch(row: LiveScoreFields): Omit<LiveScoreFields, "externalId"> {
  return {
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    minute: row.minute ?? 0,
    period: row.period ?? null,
    htHomeScore: row.htHomeScore ?? null,
    htAwayScore: row.htAwayScore ?? null,
    ftHomeScore: row.ftHomeScore ?? null,
    ftAwayScore: row.ftAwayScore ?? null,
    matchEnding: row.matchEnding ?? null,
  };
}

/**
 * Copy live scores onto the day list by `externalId`. Extra overlay rows
 * (tracked events, the live poll) that are not on the card are ignored.
 */
export function mergeLiveFixtureOverlay<T extends LiveScoreFields>(
  fixtures: T[],
  overlays: readonly LiveScoreFields[]
): T[] {
  if (overlays.length === 0) return fixtures;
  const byId = new Map<string, LiveScoreFields>();
  for (const row of overlays) {
    const id = row.externalId?.trim();
    if (!id) continue;
    const prev = byId.get(id);
    byId.set(id, prev ? preferFresherLiveScore(prev, row) : row);
  }
  if (byId.size === 0) return fixtures;
  return fixtures.map((fixture) => {
    const id = fixture.externalId?.trim();
    if (!id) return fixture;
    const overlay = byId.get(id);
    if (!overlay) return fixture;
    const chosen = preferFresherLiveScore(fixture, overlay);
    if (chosen === fixture) return fixture;
    return { ...fixture, ...scorePatch(chosen) };
  });
}
