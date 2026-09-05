import { formatEdgePlaySummary } from "@/lib/offers/offer-edge";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import type { SuggestedRace } from "@/lib/racing-desk/types";

/** Project Offer Edge plays into the Race picks dialog rows. */
export function suggestedRacesFromPlays(plays: OfferEdgePlay[]): SuggestedRace[] {
  return plays.map((play) => ({
    externalId: play.raceExternalId,
    course: play.course,
    raceName: play.raceName,
    startTime: play.startTime,
    offTime: play.offTime,
    region: play.region,
    offerId: play.offerId,
    offerTitle: play.offerTitle,
    bookmaker: play.bookmaker,
    score: 80,
    summary: formatEdgePlaySummary(play),
    oddsSource: play.oddsSource,
    exchangeSource: play.exchangeSource,
    confidence: play.confidence,
    topEv: play.totalEv,
    edge: play,
    topTarget: {
      horseId: play.runner.horseId,
      name: play.runner.name,
      marketRank: play.runner.marketRank,
      score: 80,
      summary: formatEdgePlaySummary(play),
      bookieDecimal: play.runner.backDecimal,
      exchangeDecimal: play.runner.layDecimal,
      oddsSource: play.oddsSource,
      exchangeSource: play.exchangeSource,
      qualLoss: play.qualLoss,
      freeBetEv: play.freeBetEv,
      totalEv: play.totalEv,
      confidence: play.confidence,
      offerId: play.offerId,
    },
  }));
}
