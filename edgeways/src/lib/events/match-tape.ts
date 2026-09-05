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
  minute: number;
  side: Side;
  player?: string;
  assist?: string;
  detail?: string;
  og?: boolean;
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
    if (player) event.player = player;
    if (assist) event.assist = assist;
    if (detail) event.detail = detail;
    if (row.og === true) event.og = true;
    out.push(event);
  }
  return out;
}

/** Goals only, in trigger-engine shape. Cards / subs / VAR are dropped. */
export function tapeGoals(raw: string | null | undefined): GoalEvent[] {
  return parseMatchTape(raw)
    .filter((event) => event.kind === "goal")
    .map((event) => {
      const goal: GoalEvent = { minute: event.minute, side: event.side };
      if (event.player) goal.player = event.player;
      if (event.og) goal.og = true;
      return goal;
    });
}

export function formatTapeMinute(event: Pick<MatchTapeEvent, "minute">): string {
  return `${event.minute}'`;
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
      return `${event.detail ?? "VAR"} ${clock}`;
    default:
      return event.detail ? `${event.detail} ${clock}` : `${who} ${clock}`;
  }
}
