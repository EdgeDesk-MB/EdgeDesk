import { suppressAlertKeys } from "./seen";

export function raceOffSoonAlertKey(eventId: number): string {
  return `race_off_soon:${eventId}`;
}

/**
 * Suppress the race-off prompt during the brief window between tracking a race
 * and the bet POST landing in app state. Does not skip tracking.
 */
export function suppressRaceOffSoonForBetLink(eventId: number | null | undefined): void {
  if (typeof eventId !== "number" || !Number.isFinite(eventId)) return;
  suppressAlertKeys([raceOffSoonAlertKey(eventId)]);
}
