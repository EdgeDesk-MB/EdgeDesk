/**
 * Horse racing helpers — name matching, place terms, results stored in events.goals.
 */

export interface RaceRunnerResult {
  horse: string;
  /** 1 = winner; 0 = unplaced / non-finisher */
  position: number;
}

export interface RaceResult {
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

export function serializeRaceResults(result: Omit<RaceResult, "kind">): string {
  return JSON.stringify({ kind: "horse_racing", ...result } satisfies RaceResult);
}

/** Pending racecard runners stored on tracked events before results land. */
export interface RacecardPending {
  kind: "horse_racing_card";
  runners: string[];
}

export function serializeRacecardRunners(runners: string[]): string {
  const payload: RacecardPending = {
    kind: "horse_racing_card",
    runners: runners.filter((r) => r.trim()),
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
