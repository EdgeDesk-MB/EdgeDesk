/**
 * Horse racing helpers - name matching, place terms, results stored in events.goals.
 */

import { formatClockTime } from "@/lib/time-format";

export interface RaceRunnerResult {
  horse: string;
  /** 1 = winner; 0 = unplaced / non-finisher */
  position: number;
  /** Official Starting Price as a decimal (from Racing API / paste). */
  spDecimal?: number;
  /** Display SP, e.g. "6/4" or "6/4 Fav". */
  spLabel?: string;
  /**
   * Explicit SP-favourite mark (Fav/JFav paste, manual "winner was SP favourite").
   * When set, takes precedence over deriving favourite from min spDecimal.
   */
  isSpFavourite?: boolean;
}

/** Racecard details kept on tracked events for result-dialog headers. */
export type RaceDisplayMeta = {
  type?: string;
  distance?: string;
  raceClass?: string;
  prize?: string;
  going?: string;
  /** Declared field size (may exceed placings entered in the dialog). */
  fieldSize?: number;
};

export interface RaceResult extends RaceDisplayMeta {
  kind: "horse_racing";
  winner: string;
  runners: RaceRunnerResult[];
  fieldSize: number;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Fuzzy horse name match (handles minor spelling / punctuation differences). */
export function horseNamesMatch(a: string, b: string): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4) return na.includes(nb) || nb.includes(na);
  return false;
}

/** UK place terms by field size (standard each-way rules). */
export function placePositions(fieldSize: number): number {
  if (fieldSize <= 4) return 1;
  if (fieldSize <= 7) return 2;
  return 3;
}

export function runnerPosition(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseRaceResults(goals: string | null | undefined): RaceResult | null {
  if (!goals?.trim()) return null;
  try {
    const parsed = JSON.parse(goals) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as RaceResult).kind === "horse_racing" &&
      typeof (parsed as RaceResult).winner === "string"
    ) {
      return parsed as RaceResult;
    }
  } catch {
    /* football goal timeline or legacy data */
  }
  return null;
}

/**
 * Winner-only results (e.g. manual "Set winner") lack 2nd/3rd/4th placings -
 * place-refund free bets cannot be evaluated until full API results land.
 */
export function isRaceResultIncomplete(result: RaceResult | null | undefined): boolean {
  if (!result) return true;
  const placed = result.runners.filter((r) => r.position > 0);
  return placed.length <= 1;
}

export function serializeRaceResults(result: Omit<RaceResult, "kind">): string {
  return JSON.stringify({ kind: "horse_racing", ...result } satisfies RaceResult);
}

/** Pending racecard runners stored on tracked events before results land. */
export interface RacecardPending extends RaceDisplayMeta {
  kind: "horse_racing_card";
  runners: string[];
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t ? t : undefined;
}

function pickRaceDisplayMeta(source: Record<string, unknown>): RaceDisplayMeta {
  const fieldRaw = source.fieldSize;
  const fieldSize =
    typeof fieldRaw === "number" && Number.isFinite(fieldRaw) && fieldRaw > 0
      ? Math.floor(fieldRaw)
      : undefined;
  return {
    type: optionalTrimmed(source.type),
    distance: optionalTrimmed(source.distance),
    raceClass: optionalTrimmed(source.raceClass),
    prize: optionalTrimmed(source.prize),
    going: optionalTrimmed(source.going),
    ...(fieldSize != null ? { fieldSize } : {}),
  };
}

/** Read type/prize/going/field size from pending card or finished result JSON. */
export function parseRaceDisplayMeta(
  goals: string | null | undefined
): RaceDisplayMeta {
  if (!goals?.trim()) return {};
  try {
    const parsed = JSON.parse(goals) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const obj = parsed as Record<string, unknown>;
    const kind = obj.kind;
    if (kind !== "horse_racing" && kind !== "horse_racing_card") return {};
    const meta = pickRaceDisplayMeta(obj);
    if (kind === "horse_racing_card" && Array.isArray(obj.runners)) {
      const n = obj.runners.filter((r) => typeof r === "string" && r.trim()).length;
      if (n > 0 && (meta.fieldSize == null || meta.fieldSize < n)) {
        return { ...meta, fieldSize: n };
      }
    }
    return meta;
  } catch {
    return {};
  }
}

/** Merge prior card/result meta onto a new result so headers survive settlement. */
export function withPreservedRaceDisplayMeta(
  result: Omit<RaceResult, "kind">,
  existingGoals: string | null | undefined
): Omit<RaceResult, "kind"> {
  const prev = parseRaceDisplayMeta(existingGoals);
  return {
    ...result,
    type: result.type ?? prev.type,
    distance: result.distance ?? prev.distance,
    raceClass: result.raceClass ?? prev.raceClass,
    prize: result.prize ?? prev.prize,
    going: result.going ?? prev.going,
    fieldSize: Math.max(result.fieldSize, prev.fieldSize ?? 0),
  };
}

export function serializeRacecardRunners(
  runners: string[],
  meta?: RaceDisplayMeta
): string {
  const cleaned = runners.filter((r) => r.trim());
  const payload: RacecardPending = {
    kind: "horse_racing_card",
    runners: cleaned,
    ...pickRaceDisplayMeta({ ...(meta ?? {}), fieldSize: meta?.fieldSize ?? cleaned.length }),
  };
  return JSON.stringify(payload);
}

export function parseRacecardRunners(goals: string | null | undefined): string[] {
  if (!goals?.trim()) return [];
  try {
    const parsed = JSON.parse(goals) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as RacecardPending).kind === "horse_racing_card" &&
      Array.isArray((parsed as RacecardPending).runners)
    ) {
      return (parsed as RacecardPending).runners.filter((r) => typeof r === "string" && r.trim());
    }
  } catch {
    /* finished race JSON or football timeline */
  }
  return [];
}

/**
 * Header copy for the race-result dialog (course, race name, start, meta).
 * Omits live exchange lines (Betfair lays, etc.).
 */
export function buildRaceResultDialogHeader(event: {
  competition?: string | null;
  homeTeam?: string | null;
  startTime?: number | null;
  goals?: string | null;
}): {
  title: string;
  startLabel: string | null;
  metaParts: string[];
} {
  const course = (event.competition ?? "").trim();
  const raceName = (event.homeTeam ?? "").trim();
  const title = course && raceName
    ? `${course}: ${raceName}`
    : course || raceName || "Race";

  let startLabel: string | null = null;
  if (event.startTime != null && Number.isFinite(event.startTime)) {
    const d = new Date(event.startTime);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
    startLabel = `${date}, ${formatClockTime(d)}`;
  }

  const meta = parseRaceDisplayMeta(event.goals);
  const cardCount = parseRacecardRunners(event.goals).length;
  const resultCount = parseRaceResults(event.goals)?.fieldSize ?? 0;
  const fieldSize = meta.fieldSize || cardCount || resultCount || 0;
  const places = fieldSize > 0 ? placePositions(fieldSize) : undefined;

  const metaParts: string[] = [];
  if (meta.type) metaParts.push(meta.type);
  if (meta.distance) metaParts.push(meta.distance);
  if (meta.raceClass) metaParts.push(meta.raceClass);
  if (meta.prize) metaParts.push(`Prize ${meta.prize}`);
  if (meta.going) metaParts.push(`Going: ${meta.going}`);
  if (fieldSize > 0 && places != null) {
    metaParts.push(`${fieldSize} runners · ${places} places`);
  }

  return { title, startLabel, metaParts };
}

/** Human-readable status while a race is off or awaiting a result. */
export function racingEventStatusDetail(goals: string | null | undefined): string {
  const raceResult = parseRaceResults(goals);
  if (raceResult) return `Won by ${raceResult.winner}`;
  const runners = parseRacecardRunners(goals);
  if (runners.length > 0) return `${runners.length} runners · awaiting result`;
  return "Awaiting result";
}

export function selectionPosition(selection: string, result: RaceResult): number {
  const hit = result.runners.find((r) => horseNamesMatch(r.horse, selection));
  return hit?.position ?? 0;
}

export function selectionWonRace(selection: string, result: RaceResult): boolean {
  return horseNamesMatch(selection, result.winner);
}

export function selectionPlaced(selection: string, result: RaceResult): boolean {
  const pos = selectionPosition(selection, result);
  if (pos <= 0) return false;
  return pos <= placePositions(result.fieldSize);
}

/**
 * Horses that were the Starting Price favourite (joint favs = all at the shortest SP).
 * Prefers explicit `isSpFavourite` marks; otherwise derives from min `spDecimal`.
 */
export function spFavouriteHorses(result: RaceResult): string[] {
  const marked = result.runners
    .filter((r) => r.isSpFavourite && r.horse.trim())
    .map((r) => r.horse.trim());
  if (marked.length > 0) return marked;

  const withSp = result.runners.filter(
    (r) => r.spDecimal != null && Number.isFinite(r.spDecimal) && r.spDecimal > 1
  );
  if (withSp.length === 0) return [];
  const min = Math.min(...withSp.map((r) => r.spDecimal!));
  return withSp.filter((r) => r.spDecimal === min).map((r) => r.horse.trim());
}

/**
 * Whether the race winner was an SP favourite.
 * `null` = SP favourite unknown on this result (do not invent from pre-race odds).
 */
export function winnerIsSpFavourite(result: RaceResult): boolean | null {
  const favs = spFavouriteHorses(result);
  if (favs.length === 0) return null;
  return favs.some((h) => horseNamesMatch(h, result.winner));
}

/** Mark the winner as SP favourite when SP decimals are absent (manual Set result). */
export function withWinnerMarkedSpFavourite(result: RaceResult, marked: boolean): RaceResult {
  const runners = result.runners.map((r) => {
    const isWinner =
      r.position === 1 || horseNamesMatch(r.horse, result.winner);
    if (!isWinner) {
      if (!marked && r.isSpFavourite) {
        const { isSpFavourite: _drop, ...rest } = r;
        return rest;
      }
      return r;
    }
    if (marked) return { ...r, isSpFavourite: true };
    if (r.isSpFavourite) {
      const { isSpFavourite: _drop, ...rest } = r;
      return rest;
    }
    return r;
  });
  return { ...result, runners };
}
