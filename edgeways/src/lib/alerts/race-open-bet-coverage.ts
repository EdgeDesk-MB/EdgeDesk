import type { BetRow, EventRow, OfferRow } from "@/lib/db/schema";
import { formatEventTime, localCalendarDate, racingVenueLabel } from "@/lib/events";
import { offerMatchesBetContext } from "@/lib/offers/racing-offer-rules";

type RacingOfferScope = Pick<
  OfferRow,
  | "sport"
  | "status"
  | "eventDate"
  | "scopeCourse"
  | "scopeRaceId"
  | "scopeRaceLabel"
  | "bookmaker"
  | "offerType"
  | "rules"
>;

/**
 * True when an open bet belongs to this tracked race even if `eventId` is not
 * set yet (e.g. convert logged before the race link landed).
 */
export function openBetCoversRacingEvent(
  bet: Pick<BetRow, "status" | "eventId" | "offerId" | "bookmaker">,
  event: Pick<EventRow, "id" | "sport" | "externalId" | "competition" | "startTime">,
  offer?: RacingOfferScope | null
): boolean {
  if (bet.status !== "open") return false;
  if (bet.eventId === event.id) return true;
  if (bet.eventId != null || !offer) return false;
  if (event.sport !== "horse_racing" || offer.sport !== "horse_racing") return false;

  return offerMatchesBetContext(offer, {
    date: localCalendarDate(new Date(event.startTime)),
    course: racingVenueLabel(event.competition),
    raceExternalId: event.externalId,
    offTime: formatEventTime(event.startTime),
    bookmaker: bet.bookmaker,
  });
}
