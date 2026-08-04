import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import type { RaceOfferTag, RacingDeskRace } from "@/lib/racing-desk/types";

/** Best EV among suggested runners for this offer on the race (heuristic path). */
export function offerTagBestEv(tag: RaceOfferTag): number {
  const runners = tag.suggestedRunners ?? [];
  if (runners.length === 0) return Number.NEGATIVE_INFINITY;
  return Math.max(...runners.map((r) => r.totalEv ?? Number.NEGATIVE_INFINITY));
}

/** Offer Edge play for a specific race + offer, when modelled. */
export function edgePlayForRaceOffer(
  plays: readonly OfferEdgePlay[],
  raceExternalId: string,
  offerId: number
): OfferEdgePlay | undefined {
  return plays.find((p) => p.raceExternalId === raceExternalId && p.offerId === offerId);
}

/** Prefer modelled Edge EV; fall back to heuristic suggested-runner EV. */
export function offerTagDisplayEv(
  tag: RaceOfferTag,
  play?: OfferEdgePlay | null
): number {
  if (play != null && Number.isFinite(play.totalEv)) return play.totalEv;
  return offerTagBestEv(tag);
}

/** How many races at a meeting have at least one Offer Edge play. */
export function countRecommendedRaces(
  plays: readonly OfferEdgePlay[],
  races: readonly Pick<RacingDeskRace, "externalId">[]
): number {
  if (plays.length === 0 || races.length === 0) return 0;
  const ids = new Set(races.map((r) => r.externalId));
  const recommended = new Set(
    plays.filter((p) => ids.has(p.raceExternalId)).map((p) => p.raceExternalId)
  );
  return recommended.size;
}

/** Count of Offer Edge plays on one race (one per offer). */
export function countRecommendedOffersOnRace(
  plays: readonly OfferEdgePlay[],
  raceExternalId: string
): number {
  return plays.filter((p) => p.raceExternalId === raceExternalId).length;
}

/**
 * Qualifying offers for a race, best value first.
 * Prefer Offer Edge EV when plays are supplied; else heuristic runner EV / score.
 */
export function qualifyingOfferTags(
  race: Pick<RacingDeskRace, "offerTags"> & { externalId?: string },
  edgePlays: readonly OfferEdgePlay[] = []
): RaceOfferTag[] {
  const raceId = race.externalId ?? "";
  return race.offerTags
    .filter((t) => t.qualifies)
    .slice()
    .sort((a, b) => {
      const playA = raceId
        ? edgePlayForRaceOffer(edgePlays, raceId, a.offerId)
        : undefined;
      const playB = raceId
        ? edgePlayForRaceOffer(edgePlays, raceId, b.offerId)
        : undefined;
      const evA = offerTagDisplayEv(a, playA);
      const evB = offerTagDisplayEv(b, playB);
      const finiteA = Number.isFinite(evA);
      const finiteB = Number.isFinite(evB);
      if (finiteA && finiteB && evB !== evA) return evB - evA;
      if (finiteA !== finiteB) return finiteA ? -1 : 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
}

export function findOfferTag(
  race: Pick<RacingDeskRace, "offerTags"> & { externalId?: string },
  offerId: number | null | undefined,
  edgePlays: readonly OfferEdgePlay[] = []
): RaceOfferTag | null {
  if (offerId == null) return qualifyingOfferTags(race, edgePlays)[0] ?? null;
  return race.offerTags.find((t) => t.qualifies && t.offerId === offerId) ?? null;
}
