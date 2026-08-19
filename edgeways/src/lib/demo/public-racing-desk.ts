/**
 * Canned Racing Desk for public /demo. Live /api/racing/desk would otherwise
 * leak the host's Racing API day (empty Race picks on a finished card).
 */
import { buildOfferEdgePlays, formatEdgePlaySummary } from "@/lib/offers/offer-edge";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import type { BetGetFreePlaceRules } from "@/lib/offers/racing-offer-rules";
import { placePositions } from "@/lib/racing";
import type {
  RacingDeskActiveOffer,
  RacingDeskPayload,
  RacingDeskRace,
  RacingRunnerDetail,
  SuggestedRace,
} from "@/lib/racing-desk/types";
import { demoRacecards } from "@/lib/services/theracingapi";

const DEMO_OFFER_ID = 18;
const DEMO_OFFER_TITLE = "Bet £50 get £50 free bet if 2nd, 3rd or 4th";
const DEMO_BOOKMAKER = "Sky Bet";

const DEMO_RULES: BetGetFreePlaceRules = {
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3, 4],
  betStake: 50,
  freeBetAmount: 50,
};

function priceDemoRunner(runner: RacingRunnerDetail): RacingRunnerDetail {
  const back = runner.spDecimal ?? 0;
  if (back <= 1) {
    return { ...runner, oddsSource: "unavailable" };
  }
  const lay = Math.round(back * 1.03 * 100) / 100;
  return {
    ...runner,
    bookieDecimal: back,
    exchangeDecimal: lay,
    exchangeBackDecimal: back,
    exchangeSource: "estimated",
    oddsSource: "snapshot",
    spreadPct: 3,
  };
}

function demoActiveOffer(): RacingDeskActiveOffer {
  return {
    id: DEMO_OFFER_ID,
    title: DEMO_OFFER_TITLE,
    bookmaker: DEMO_BOOKMAKER,
    scopeCourse: "all",
    scopeRaceLabel: null,
    eventDate: null,
    rulesSummary: "Bet £50, free £50 if 2nd, 3rd or 4th. 8+ runners, GB & IRE.",
  };
}

function toDeskRace(card: ReturnType<typeof demoRacecards>[number]): RacingDeskRace {
  const runners = card.runnerDetails.filter((r) => !r.nonRunner).map(priceDemoRunner);
  return {
    externalId: card.externalId,
    course: card.course,
    raceName: card.raceName,
    startTime: card.startTime,
    offTime: card.offTime ?? "14:30",
    status: card.status === "finished" ? "finished" : "upcoming",
    fieldSize: card.fieldSize,
    distance: card.distance,
    going: card.going,
    raceClass: card.raceClass,
    type: card.type,
    prize: card.prize,
    region: card.region,
    runners,
    openBetCount: 0,
    standardPlaces: placePositions(card.fieldSize, {
      type: card.type,
      raceName: card.raceName,
    }),
    offerTags: [],
    oddsSource: "snapshot",
    pricedRunnerCount: runners.filter((r) => (r.bookieDecimal ?? 0) > 1).length,
    exchangeSource: "estimated",
  };
}

function attachOfferTags(race: RacingDeskRace, plays: OfferEdgePlay[]): RacingDeskRace {
  const play = plays.find((p) => p.raceExternalId === race.externalId);
  const qualifies = race.fieldSize >= DEMO_RULES.minRunners;
  return {
    ...race,
    offerTags: [
      {
        offerId: DEMO_OFFER_ID,
        offerTitle: DEMO_OFFER_TITLE,
        qualifies,
        betStake: DEMO_RULES.betStake,
        freeBetAmount: DEMO_RULES.freeBetAmount,
        bookmaker: DEMO_BOOKMAKER,
        triggerText: "2nd, 3rd or 4th",
        qualifyingPlaces: DEMO_RULES.qualifyingPlaces,
        minRunners: DEMO_RULES.minRunners,
        score: play ? 80 : qualifies ? 40 : undefined,
        summary: play ? formatEdgePlaySummary(play) : undefined,
        suggestedRunners: play
          ? [
              {
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
            ]
          : undefined,
      },
    ],
  };
}

function suggestionsFromPlays(plays: OfferEdgePlay[]): SuggestedRace[] {
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

export function publicDemoRacingDesk(date: string): RacingDeskPayload {
  const races = demoRacecards(date).map(toDeskRace);
  const plays = buildOfferEdgePlays(
    {
      id: DEMO_OFFER_ID,
      title: DEMO_OFFER_TITLE,
      bookmaker: DEMO_BOOKMAKER,
      rules: DEMO_RULES,
    },
    races,
    { date, retention: 0.8, retentionSampleSize: 0 }
  );
  const tagged = races.map((race) => attachOfferTags(race, plays));

  return {
    date,
    summary: {
      raceCount: tagged.length,
      upcomingCount: tagged.filter((r) => r.status === "upcoming").length,
      trackedCount: 0,
      openPositions: 0,
      racingPnlToday: 0,
      source: "demo",
      oddsSnapshotsEnabled: false,
      premiumOddsApi: false,
      oddsTier: "demo",
      resultsTier: "none",
      exchangeProvider: "betfair",
      exchangeName: "Betfair",
      settingsExchangeProvider: "betfair",
      settingsExchangeName: "Betfair",
      deskExchangeOverride: null,
      exchangeStatus: "not_configured",
    },
    races: tagged,
    activeOffers: [demoActiveOffer()],
    activeBets: [],
    racingPnlDay: {
      total: 0,
      openCount: 0,
      settledCount: 0,
      rows: [],
      cumulative: [],
      markers: [],
    },
    suggestedRaces: suggestionsFromPlays(plays),
    edgePlays: plays,
  };
}

export function publicDemoOfferEdge(date: string) {
  const desk = publicDemoRacingDesk(date);
  return { date, plays: desk.edgePlays, source: desk.summary.source };
}
