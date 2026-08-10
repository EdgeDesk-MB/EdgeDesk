/**
 * Compact event result for settlement alert bodies (toast + push).
 * Racing: finishing position ("Finished 4th"). Football: FT/live score ("2–1").
 */

import { formatFinishingPosition } from "@/lib/bet-outcomes";
import { parseRaceResults, selectionPosition } from "@/lib/racing";

export type SettlementResultEvent = {
  sport?: string | null;
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  goals?: string | null;
};

function isRacingSport(sport: string | null | undefined): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}

/** Alert-facing race place: always "Finished Nth" (including 1st). */
export function formatAlertRacePosition(position: number): string | null {
  if (position <= 0) return null;
  if (position === 1) return "Finished 1st";
  return formatFinishingPosition(position);
}

/**
 * Human result snippet for a settled bet's linked event, or null when unknown.
 */
export function settlementEventResultLabel(input: {
  selection?: string | null;
  sport?: string | null;
  event?: SettlementResultEvent | null;
}): string | null {
  const event = input.event;
  if (!event) return null;

  const sport = input.sport?.trim() || event.sport?.trim() || null;

  if (isRacingSport(sport) || isRacingSport(event.sport)) {
    const race = parseRaceResults(event.goals);
    const selection = input.selection?.trim();
    if (!race || !selection) return null;
    return formatAlertRacePosition(selectionPosition(selection, race));
  }

  if (sport != null && sport !== "football") return null;

  const home = event.homeScore;
  const away = event.awayScore;
  if (home == null || away == null) return null;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  // Scores are meaningful once the match has started (live 2UP) or finished.
  if (event.status !== "finished" && event.status !== "live") return null;
  return `${home}–${away}`;
}
