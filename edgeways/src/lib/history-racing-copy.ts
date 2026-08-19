import {
  formatPositionOrdinal,
  parseRaceResults,
  type RaceResult,
} from "@/lib/racing";
import type { HistoryTitlePart } from "@/lib/history-goal-copy";

const FEED_PLACE_LIMIT = 3;

export interface RacingResultCopy {
  label: string;
  parts: HistoryTitlePart[];
}

function placedRunners(race: RaceResult): RaceResult["runners"] {
  const placed = race.runners
    .filter((runner) => runner.position > 0)
    .sort((a, b) => a.position - b.position);
  if (placed.length === 0 && race.winner.trim()) {
    return [{ horse: race.winner, position: 1 }];
  }
  return placed;
}

/**
 * Race-only result subline: `Result` + `[1st] Winner · [2nd] …`
 * The label is bold in the feed. Positions and horse names stay regular.
 */
export function formatRacingResultCopy(race: RaceResult): RacingResultCopy {
  const placed = placedRunners(race).slice(0, FEED_PLACE_LIMIT);
  const parts: HistoryTitlePart[] = [];
  for (const [index, runner] of placed.entries()) {
    if (index > 0) parts.push({ text: " · " });
    const ordinal = formatPositionOrdinal(runner.position) ?? String(runner.position);
    parts.push({ text: `[${ordinal}] ${runner.horse}` });
  }
  return { label: "Result", parts };
}

export function racingResultCopyFromGoals(
  goals: string | null | undefined,
  detail?: string | null
): RacingResultCopy | null {
  const race = parseRaceResults(goals);
  if (race) return formatRacingResultCopy(race);

  const wonBy = detail?.trim().match(/won by\s+(.+)$/i);
  if (wonBy?.[1]) {
    return {
      label: "Result",
      parts: [{ text: `[1st] ${wonBy[1].trim()}` }],
    };
  }
  return null;
}
