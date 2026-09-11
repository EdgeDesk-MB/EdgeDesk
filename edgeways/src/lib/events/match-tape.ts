/**
 * Football match event tape stored in `events.goals`.
 *
 * Legacy rows are a JSON array of `{minute, side, player?, og?}` (goals only).
 * Phase 1 stores typed `MatchTapeEvent` rows so cards, subs and VAR can sit
 * on the same column without breaking trigger settlement.
 */

import type { GoalEvent, Side } from "@/lib/calc";

export const MATCH_TAPE_KINDS = ["goal", "card", "subst", "var", "other"] as const;
export type MatchTapeKind = (typeof MATCH_TAPE_KINDS)[number];

export interface MatchTapeEvent {
  kind: MatchTapeKind;
  /** Elapsed + added time. Same value the feed mapper has always stored. */
  minute: number;
  /** Added time only. When set, the clock is `{minute - extra}+{extra}'`. */
  extra?: number;
  side: Side;
  player?: string;
  assist?: string;
  detail?: string;
  /** Provider VAR reason (`Offside`, `Foul`, …). */
  comments?: string;
  og?: boolean;
}

export const TAPE_PERIODS = ["first", "second", "extra", "penalties"] as const;
export type TapePeriodId = (typeof TAPE_PERIODS)[number];

export const TAPE_PERIOD_LABEL: Record<TapePeriodId, string> = {
  first: "First half",
  second: "Second half",
  extra: "Extra time",
  penalties: "Penalties",
};

export interface TapeScore {
  home: number;
  away: number;
}

const KIND_SET = new Set<string>(MATCH_TAPE_KINDS);

function asSide(value: unknown): Side | null {
  return value === "home" || value === "away" ? value : null;
}

function asMinute(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asOptionalExtra(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

function inferKind(row: Record<string, unknown>): MatchTapeKind {
  const raw = typeof row.kind === "string" ? row.kind.toLowerCase() : "";
  if (KIND_SET.has(raw)) return raw as MatchTapeKind;
  // Legacy goal-only rows have no kind.
  return "goal";
}

export function parseMatchTape(raw: string | null | undefined): MatchTapeEvent[] {
  if (!raw || raw === "[]") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: MatchTapeEvent[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const side = asSide(row.side);
    if (!side) continue;
    const kind = inferKind(row);
    const event: MatchTapeEvent = {
      kind,
      minute: asMinute(row.minute),
      side,
    };
    const player = asOptionalString(row.player);
    const assist = asOptionalString(row.assist);
    const detail = asOptionalString(row.detail);
    const comments = asOptionalString(row.comments);
    if (player) event.player = player;
    if (assist) event.assist = assist;
    if (detail) event.detail = detail;
    if (comments) event.comments = comments;
    const extra = asOptionalExtra(row.extra);
    if (extra != null) event.extra = extra;
    if (row.og === true) event.og = true;
    out.push(event);
  }
  return out;
}

/** VAR rows that take a goal off the board. Penalty reviews do not. */
export function isGoalCancelVar(event: Pick<MatchTapeEvent, "kind" | "detail">): boolean {
  if (event.kind !== "var") return false;
  const detail = (event.detail ?? "").toLowerCase();
  if (detail.includes("penalty")) return false;
  return (
    detail.includes("goal cancelled") ||
    detail.includes("goal canceled") ||
    detail.includes("goal disallowed")
  );
}

/**
 * Indexes of `kind: "goal"` rows later cancelled by VAR.
 * Matches the latest still-standing goal on that side.
 */
export function disallowedGoalIndexes(events: MatchTapeEvent[]): Set<number> {
  const open: { index: number; side: Side }[] = [];
  const cancelled = new Set<number>();
  events.forEach((event, index) => {
    if (event.kind === "goal") {
      open.push({ index, side: event.side });
      return;
    }
    if (!isGoalCancelVar(event)) return;
    let found = -1;
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i]!.side === event.side) {
        found = i;
        break;
      }
    }
    if (found < 0) return;
    cancelled.add(open[found]!.index);
    open.splice(found, 1);
  });
  return cancelled;
}

function toGoalEvent(event: MatchTapeEvent): GoalEvent {
  const goal: GoalEvent = { minute: event.minute, side: event.side };
  if (event.player) goal.player = event.player;
  if (event.og) goal.og = true;
  return goal;
}

/** Standing goals only. Cards, subs, VAR, and cancelled goals are dropped. */
export function tapeGoals(raw: string | null | undefined): GoalEvent[] {
  return standingTapeGoals(parseMatchTape(raw)).map(toGoalEvent);
}

/** Goal rows that still count after VAR cancellations. */
export function standingTapeGoals(events: MatchTapeEvent[]): MatchTapeEvent[] {
  const cancelled = disallowedGoalIndexes(events);
  return events.filter((event, index) => event.kind === "goal" && !cancelled.has(index));
}

/**
 * Official fixture score wins when both exist, so a cancelled goal still on
 * the tape cannot hold the board at 1–0. If VAR has already taken a goal off
 * the tape and the fixture score has not dropped yet, follow the tape.
 */
export function preferPublishedScore(
  published: number | undefined,
  fromTape: number | undefined,
  opts?: { tapeHasGoalCancel?: boolean }
): number | undefined {
  if (published == null) return fromTape;
  if (
    opts?.tapeHasGoalCancel &&
    fromTape != null &&
    fromTape < published
  ) {
    return fromTape;
  }
  return published;
}

/** Regulation minute, stripping added time when `extra` is present. */
export function tapeElapsed(event: Pick<MatchTapeEvent, "minute" | "extra">): number {
  const extra = event.extra ?? 0;
  if (extra > 0 && event.minute >= extra) return event.minute - extra;
  return event.minute;
}

export function formatTapeMinute(
  event: Pick<MatchTapeEvent, "minute" | "extra">
): string {
  const extra = event.extra ?? 0;
  if (extra > 0) return `${tapeElapsed(event)}+${extra}'`;
  return `${event.minute}'`;
}

export function tapePeriodId(event: MatchTapeEvent): TapePeriodId {
  const elapsed = tapeElapsed(event);
  const detail = (event.detail ?? "").toLowerCase();
  if (elapsed > 120 || detail.includes("penalty shootout")) return "penalties";
  if (elapsed > 90) return "extra";
  if (elapsed > 45) return "second";
  return "first";
}

export function sortTapeEvents(events: MatchTapeEvent[]): MatchTapeEvent[] {
  return [...events].sort((a, b) => {
    const elapsedDiff = tapeElapsed(a) - tapeElapsed(b);
    if (elapsedDiff !== 0) return elapsedDiff;
    return (a.extra ?? 0) - (b.extra ?? 0);
  });
}

export function groupTapeByPeriod(
  events: MatchTapeEvent[]
): { period: TapePeriodId; events: MatchTapeEvent[] }[] {
  const groups: { period: TapePeriodId; events: MatchTapeEvent[] }[] = [];
  for (const event of sortTapeEvents(events)) {
    const period = tapePeriodId(event);
    const last = groups[groups.length - 1];
    if (last?.period === period) last.events.push(event);
    else groups.push({ period, events: [event] });
  }
  return groups;
}

export function formatTapeScore(score: TapeScore): string {
  return `${score.home}–${score.away}`;
}

/** Running score after each row. Goals increment; VAR goal-cancelled decrements. */
export function tapeRunningScores(events: MatchTapeEvent[]): TapeScore[] {
  const open: Side[] = [];
  let home = 0;
  let away = 0;
  return events.map((event) => {
    if (event.kind === "goal") {
      if (event.side === "home") home += 1;
      else away += 1;
      open.push(event.side);
    } else if (isGoalCancelVar(event)) {
      const found = open.lastIndexOf(event.side);
      if (found >= 0) {
        open.splice(found, 1);
        if (event.side === "home") home = Math.max(0, home - 1);
        else away = Math.max(0, away - 1);
      }
    }
    return { home, away };
  });
}

export function scoreThroughTape(
  events: MatchTapeEvent[],
  throughIndexInclusive: number
): TapeScore {
  const scores = tapeRunningScores(events);
  if (throughIndexInclusive < 0) return { home: 0, away: 0 };
  return scores[Math.min(throughIndexInclusive, scores.length - 1)] ?? {
    home: 0,
    away: 0,
  };
}

export function periodEndScore(
  events: MatchTapeEvent[],
  period: TapePeriodId,
  opts?: {
    htHome?: number | null;
    htAway?: number | null;
    live?: TapeScore | null;
    isLastPeriod?: boolean;
  }
): TapeScore {
  if (opts?.isLastPeriod && opts.live) return opts.live;
  if (
    period === "first" &&
    typeof opts?.htHome === "number" &&
    typeof opts?.htAway === "number"
  ) {
    return { home: opts.htHome, away: opts.htAway };
  }
  const lastIdx = events.findLastIndex((event) => tapePeriodId(event) === period);
  return scoreThroughTape(events, lastIdx);
}

const HIDDEN_DETAILS = new Set([
  "yellow card",
  "red card",
  "second yellow card",
  "normal goal",
]);

const DETAIL_LABEL: Record<string, string> = {
  "missed penalty": "Missed penalty",
  "own goal": "Own goal",
  penalty: "Penalty",
  "goal cancelled": "Goal cancelled",
  "goal canceled": "Goal cancelled",
  "goal disallowed": "Goal disallowed",
};

function sentenceCaseFallback(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function formatTapeDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const key = detail.trim().toLowerCase();
  if (HIDDEN_DETAILS.has(key)) return undefined;
  return DETAIL_LABEL[key] ?? sentenceCaseFallback(detail);
}

export function goalCaption(event: MatchTapeEvent): string | undefined {
  if (event.og) return "Own goal";
  const detail = formatTapeDetail(event.detail);
  if (detail) return detail;
  return event.assist;
}

export function varCaption(event: MatchTapeEvent): string {
  const detail = formatTapeDetail(event.detail) ?? "VAR";
  const reason = formatTapeDetail(event.comments);
  if (reason && reason.toLowerCase() !== detail.toLowerCase()) {
    return `${detail} · ${reason}`;
  }
  return detail;
}

export function cardTone(
  detail: string | undefined
): "yellow" | "red" | "second-yellow" {
  const key = (detail ?? "").toLowerCase();
  if (key.includes("second yellow")) return "second-yellow";
  if (key.includes("red")) return "red";
  return "yellow";
}

export function cardCaption(detail: string | undefined): string {
  const tone = cardTone(detail);
  if (tone === "second-yellow") return "Second yellow";
  if (tone === "red") return "Red card";
  return "Yellow card";
}

export function formatTapeLine(
  event: MatchTapeEvent,
  teams: { homeTeam: string; awayTeam: string }
): string {
  const who =
    event.player ?? (event.side === "home" ? teams.homeTeam : teams.awayTeam);
  const clock = formatTapeMinute(event);
  switch (event.kind) {
    case "goal":
      return event.og ? `${who} ${clock} (og)` : `${who} ${clock}`;
    case "card":
      return `${who} ${clock} · ${event.detail ?? "Card"}`;
    case "subst":
      return event.assist
        ? `${event.assist} on for ${who} ${clock}`
        : `${who} ${clock} · Sub`;
    case "var":
      return `${varCaption(event)} ${clock}`;
    default:
      return event.detail ? `${event.detail} ${clock}` : `${who} ${clock}`;
  }
}
