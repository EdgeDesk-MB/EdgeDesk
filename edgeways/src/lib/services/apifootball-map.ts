/**
 * Pure API-Football payload mappers. Kept off the fetch client so score and
 * tape mapping can be tested without spending quota.
 */
import type { FootballLineupPlayer, FootballLineups } from "@/lib/events/lineups";
import {
  isGoalCancelVar,
  mergeMatchTapeKeys,
  standingTapeGoals,
  type MatchTapeEvent,
  type MatchTapeKind,
} from "@/lib/events/match-tape";

export const LIVE_FIXTURE_STATUSES = [
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
  "BREAK",
  "SUSP",
] as const;

export const FINISHED_FIXTURE_STATUSES = ["FT", "AET", "PEN"] as const;

export type ScorePair = { home: number; away: number };

export type MappedFixtureScores = {
  homeScore: number;
  awayScore: number;
  minute: number;
  ftHomeScore: number | null;
  ftAwayScore: number | null;
  matchEnding: "ft" | "aet" | "pen" | null;
  period: string | null;
  htHomeScore: number | null;
  htAwayScore: number | null;
  status: "upcoming" | "live" | "finished";
};

export type TapeMapContext = {
  homeTeamName: string;
  homeTeamId?: number | null;
};

function asScore(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function scorePair(raw: unknown): ScorePair | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { home?: unknown; away?: unknown };
  const home = asScore(row.home);
  const away = asScore(row.away);
  if (home == null || away == null) return null;
  return { home, away };
}

export function maxScorePair(a: ScorePair | null, b: ScorePair | null): ScorePair | null {
  if (!a) return b;
  if (!b) return a;
  return { home: Math.max(a.home, b.home), away: Math.max(a.away, b.away) };
}

function addScorePair(a: ScorePair, b: ScorePair): ScorePair {
  return { home: a.home + b.home, away: a.away + b.away };
}

function pairSum(pair: ScorePair): number {
  return pair.home + pair.away;
}

/**
 * Official score from `goals` plus `score.halftime` / `fulltime` / `extratime`.
 * A date-list row can show 1–1 while `goals` on a later id fetch is only the
 * second-half 0–1. Lift to HT/FT so list and match view stay 1:1.
 */
export function mapFixtureScores(item: {
  fixture?: { status?: { short?: string; elapsed?: number } };
  goals?: unknown;
  score?: {
    halftime?: unknown;
    fulltime?: unknown;
    extratime?: unknown;
  };
}): MappedFixtureScores {
  const shortStatus: string = item.fixture?.status?.short ?? "NS";
  const elapsed = item.fixture?.status?.elapsed;
  const isLive = (LIVE_FIXTURE_STATUSES as readonly string[]).includes(shortStatus);
  const isFinished = (FINISHED_FIXTURE_STATUSES as readonly string[]).includes(shortStatus);
  const isAet = shortStatus === "AET";
  const isPen = shortStatus === "PEN";
  const goals = scorePair(item.goals);
  const ht = scorePair(item.score?.halftime);
  const ft = scorePair(item.score?.fulltime);
  const et = scorePair(item.score?.extratime);

  let current: ScorePair;
  if (isFinished) {
    const regulation = maxScorePair(ft, goals) ?? ft ?? goals ?? ht ?? { home: 0, away: 0 };
    if (isAet || isPen) {
      const composed = et && (ft ?? regulation) ? addScorePair(ft ?? regulation, et) : null;
      const candidates = [goals, composed, regulation].filter((row): row is ScorePair => row != null);
      current = candidates.reduce((best, row) => (pairSum(row) >= pairSum(best) ? row : best));
    } else {
      current = maxScorePair(maxScorePair(goals, ft), ht) ?? { home: 0, away: 0 };
    }
  } else {
    current = maxScorePair(goals, ht) ?? goals ?? ht ?? { home: 0, away: 0 };
  }

  return {
    homeScore: current.home,
    awayScore: current.away,
    minute: typeof elapsed === "number" ? elapsed : shortStatus === "HT" ? 45 : 0,
    ftHomeScore: isAet || isPen ? (ft?.home ?? null) : null,
    ftAwayScore: isAet || isPen ? (ft?.away ?? null) : null,
    matchEnding: isAet ? "aet" : isPen ? "pen" : shortStatus === "FT" ? "ft" : null,
    period: isLive || isFinished ? shortStatus : null,
    htHomeScore: ht?.home ?? null,
    htAwayScore: ht?.away ?? null,
    status: isLive ? "live" : isFinished ? "finished" : "upcoming",
  };
}

const normaliseTeam = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function asTeamId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function mapEventKind(type: string | undefined): MatchTapeKind {
  const t = (type ?? "").toLowerCase();
  if (t === "goal") return "goal";
  if (t === "card") return "card";
  if (t === "subst" || t === "substitution") return "subst";
  if (t === "var") return "var";
  return "other";
}

function mapTapeClock(e: { time?: { elapsed?: number; extra?: number } }): {
  minute: number;
  extra?: number;
} {
  const elapsed = e.time?.elapsed ?? 0;
  const extra = e.time?.extra ?? 0;
  const minute = elapsed + extra;
  return extra > 0 ? { minute, extra } : { minute };
}

function eventSide(
  team: { id?: unknown; name?: unknown } | undefined,
  ctx: TapeMapContext
): "home" | "away" {
  const teamId = asTeamId(team?.id);
  if (teamId != null && ctx.homeTeamId != null) {
    return teamId === ctx.homeTeamId ? "home" : "away";
  }
  return normaliseTeam(String(team?.name ?? "")) === normaliseTeam(ctx.homeTeamName)
    ? "home"
    : "away";
}

export function mapTapeEvent(e: any, ctx: TapeMapContext): MatchTapeEvent | null {
  if (!e || typeof e !== "object") return null;
  const side = eventSide(e.team, ctx);
  const kind = mapEventKind(e.type);
  const clock = mapTapeClock(e);
  if (kind === "goal" && e.detail === "Missed Penalty") {
    return {
      kind: "other",
      ...clock,
      side,
      player: e.player?.name || undefined,
      detail: "Missed Penalty",
    };
  }
  const event: MatchTapeEvent = {
    kind,
    ...clock,
    side,
  };
  if (e.player?.name) event.player = String(e.player.name);
  if (e.assist?.name) event.assist = String(e.assist.name);
  if (e.detail) event.detail = String(e.detail);
  if (e.comments) event.comments = String(e.comments);
  if (e.detail === "Own Goal") event.og = true;
  return event;
}

export function mapTapeEvents(rows: unknown, ctx: TapeMapContext): MatchTapeEvent[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => mapTapeEvent(row, ctx))
    .filter((row): row is MatchTapeEvent => row != null);
}

export function tapeContextFromFixtureItem(
  item: { teams?: { home?: { id?: unknown; name?: unknown } } },
  homeTeamName?: string
): TapeMapContext {
  const name =
    homeTeamName?.trim() ||
    (typeof item.teams?.home?.name === "string" ? item.teams.home.name : "");
  return {
    homeTeamName: name,
    homeTeamId: asTeamId(item.teams?.home?.id),
  };
}

/** Standing goals below the published total, and no VAR cancel on the tape. */
export function tapeLooksShortOfScore(
  events: MatchTapeEvent[],
  homeScore: number,
  awayScore: number
): boolean {
  if (events.some((event) => isGoalCancelVar(event))) return false;
  const standing = standingTapeGoals(events);
  const fromTape = standing.reduce(
    (sum, event) => {
      if (event.side === "home") sum.home += 1;
      else sum.away += 1;
      return sum;
    },
    { home: 0, away: 0 }
  );
  return fromTape.home < homeScore || fromTape.away < awayScore;
}

export function mergeMatchTapes(
  first: MatchTapeEvent[],
  second: MatchTapeEvent[]
): MatchTapeEvent[] {
  return mergeMatchTapeKeys(first, second);
}

function mapLineupPlayers(raw: unknown): FootballLineupPlayer[] {
  if (!Array.isArray(raw)) return [];
  const out: FootballLineupPlayer[] = [];
  for (const row of raw) {
    const player = row?.player;
    const name = player?.name ? String(player.name).trim() : "";
    if (!name) continue;
    const item: FootballLineupPlayer = { name };
    if (typeof player?.number === "number") item.number = player.number;
    if (player?.grid) item.grid = String(player.grid);
    out.push(item);
  }
  return out;
}

export function mapLineupsPayload(rows: unknown): FootballLineups | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const home = rows[0];
  const away = rows[1] ?? rows.find((r) => r?.team?.id !== home?.team?.id);
  const homeCoach = home?.coach?.name ? String(home.coach.name).trim() : "";
  const awayCoach = away?.coach?.name ? String(away.coach.name).trim() : "";
  const homeSubs = mapLineupPlayers(home?.substitutes);
  const awaySubs = mapLineupPlayers(away?.substitutes);
  const data: FootballLineups = {
    homeFormation: home?.formation ? String(home.formation) : null,
    awayFormation: away?.formation ? String(away.formation) : null,
    home: mapLineupPlayers(home?.startXI),
    away: mapLineupPlayers(away?.startXI),
    ...(homeCoach ? { homeCoach } : {}),
    ...(awayCoach ? { awayCoach } : {}),
    ...(homeSubs.length > 0 ? { homeSubs } : {}),
    ...(awaySubs.length > 0 ? { awaySubs } : {}),
  };
  if (data.home.length === 0 && data.away.length === 0) return null;
  return data;
}
