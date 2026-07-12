import type { RaceOfferTag, RacingDeskRace } from "@/lib/racing-desk/types";

/** Best EV among suggested runners for this offer on the race. */
export function offerTagBestEv(tag: RaceOfferTag): number {
  const runners = tag.suggestedRunners ?? [];
  if (runners.length === 0) return Number.NEGATIVE_INFINITY;
  return Math.max(...runners.map((r) => r.totalEv ?? Number.NEGATIVE_INFINITY));
}

/**
 * Qualifying offers for a race, best value first.
 * Prefer runner EV (offer-specific); fall back to race strategy score.
 */
export function qualifyingOfferTags(race: Pick<RacingDeskRace, "offerTags">): RaceOfferTag[] {
  return race.offerTags
    .filter((t) => t.qualifies)
    .slice()
    .sort((a, b) => {
      const evA = offerTagBestEv(a);
      const evB = offerTagBestEv(b);
      const finiteA = Number.isFinite(evA);
      const finiteB = Number.isFinite(evB);
      if (finiteA && finiteB && evB !== evA) return evB - evA;
      if (finiteA !== finiteB) return finiteA ? -1 : 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
}

export function findOfferTag(
  race: Pick<RacingDeskRace, "offerTags">,
  offerId: number | null | undefined
): RaceOfferTag | null {
  if (offerId == null) return qualifyingOfferTags(race)[0] ?? null;
  return race.offerTags.find((t) => t.qualifies && t.offerId === offerId) ?? null;
}
