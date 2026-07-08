import { parseRaceResults } from "@/lib/racing";
import type { RacingDeskRace } from "@/lib/racing-desk/types";

export interface PendingSettleRace {
  id: string;
  label: string;
  course: string;
  offTime: string;
  trackedEventId?: number;
}

/** Tracked event passed off time without a stored race result. */
export function isEventPendingSettle(event: {
  sport: string;
  startTime: number;
  goals?: string | null;
}): boolean {
  if (event.sport !== "horse_racing") return false;
  if (event.startTime > Date.now()) return false;
  return parseRaceResults(event.goals) == null;
}

/** Racing Desk race is tracked and past off without a finished result. */
export function isDeskRacePendingSettle(race: RacingDeskRace): boolean {
  if (!race.trackedEventId) return false;
  if (race.startTime > Date.now()) return false;
  return race.status !== "finished";
}

export function deskRaceToPendingSettle(race: RacingDeskRace): PendingSettleRace {
  return {
    id: race.externalId,
    label: `${race.course} · ${race.raceName}`,
    course: race.course,
    offTime: race.offTime,
    trackedEventId: race.trackedEventId,
  };
}

export function eventToPendingSettle(event: {
  id: number;
  homeTeam: string;
  awayTeam: string;
  competition?: string | null;
}): PendingSettleRace {
  return {
    id: String(event.id),
    label: `${event.competition ?? "Race"} · ${event.homeTeam}`,
    course: event.competition ?? "Race",
    offTime: event.awayTeam,
    trackedEventId: event.id,
  };
}
