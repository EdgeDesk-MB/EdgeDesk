import type { AddBetPrefill } from "@/components/add-bet-dialog";
import type { Fixture, RacingFixture } from "@/components/events/types";
import { formatRacingEventTitle, localCalendarDate } from "@/lib/events";
import { sortRunnerNamesByOdds } from "@/lib/racing/odds";

/** Prefill key used to link a live-view fixture without tracking until save. */
export function liveViewExternalId(prefill: {
  liveExternalId?: string;
  raceExternalId?: string;
} | null | undefined): string {
  return prefill?.liveExternalId?.trim() || prefill?.raceExternalId?.trim() || "";
}

/**
 * Open Add bet from a live-view modal. Links the feed card; the desk event is
 * created only when the bet is saved. Pass `trackedEventId` when already tracked.
 */
export function liveViewFootballAddBetPrefill(
  fixture: Fixture,
  trackedEventId?: number
): AddBetPrefill {
  return {
    ...(trackedEventId != null ? { eventId: trackedEventId } : {}),
    liveExternalId: fixture.externalId,
    eventDate: localCalendarDate(new Date(fixture.startTime)),
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    sport: "football",
    market: "match_odds",
    labelSuggestion: `${fixture.homeTeam} v ${fixture.awayTeam}`,
  };
}

export function liveViewRacingAddBetPrefill(
  race: RacingFixture,
  trackedEventId?: number
): AddBetPrefill {
  const runners =
    race.runnerDetails && race.runnerDetails.length > 0
      ? sortRunnerNamesByOdds(race.runnerDetails)
      : race.runners;
  return {
    ...(trackedEventId != null ? { eventId: trackedEventId } : {}),
    liveExternalId: race.externalId,
    raceExternalId: race.externalId,
    raceEventDate: localCalendarDate(new Date(race.startTime)),
    homeTeam: race.raceName,
    awayTeam: race.offTime,
    sport: "horse_racing",
    market: "win",
    labelSuggestion: formatRacingEventTitle({
      competition: race.course,
      startTime: race.startTime,
      awayTeam: race.offTime,
    }),
    runners,
  };
}
