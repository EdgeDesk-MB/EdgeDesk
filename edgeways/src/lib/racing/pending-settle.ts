import { isRaceResultIncomplete, parseRaceResults } from "@/lib/racing";
import type { RacingDeskRace } from "@/lib/racing-desk/types";
import { formatEventTime, formatRacingOffTime } from "@/lib/events";

export interface PendingSettleRace {
  id: string;
  label: string;
  course: string;
  /** Canonical 24h HH:mm - render via formatClockString for the user's preference. */
  offTime: string;
  trackedEventId?: number;
}

/** Tracked horse race that has started and still needs a full result (missing or winner-only). */
export function isEventPendingSettle(event: {
  sport: string;
  startTime: number;
  goals?: string | null;
}): boolean {
  if (event.sport !== "horse_racing") return false;
  if (event.startTime > Date.now()) return false;
  const result = parseRaceResults(event.goals);
  if (result == null) return true;
  return isRaceResultIncomplete(result);
}

/** Tracked Racing Desk race that has started and is not finished. */
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
    offTime: race.startTime ? formatEventTime(race.startTime) : race.offTime,
    trackedEventId: race.trackedEventId,
  };
}

export function eventToPendingSettle(event: {
  id: number;
  homeTeam: string;
  awayTeam: string;
  competition?: string | null;
  startTime?: number;
}): PendingSettleRace {
  const offTime =
    event.startTime != null
      ? formatEventTime(event.startTime)
      : formatRacingOffTime(event.awayTeam);
  return {
    id: String(event.id),
    label: `${event.competition ?? "Race"} · ${event.homeTeam}`,
    course: event.competition ?? "Race",
    offTime,
    trackedEventId: event.id,
  };
}
