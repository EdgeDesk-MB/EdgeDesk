/**
 * Offer Edge - given one offer and today's races, which race and which horse.
 *
 * Everything here is driven by the finishing-position model in
 * `src/lib/calc/racing/finish-positions.ts`, not by hand-tuned bonuses. The rank
 * heuristic that used to pick targets awarded market rank 2 a flat score and
 * excluded the favourite outright, which is wrong whenever the favourite is weak:
 * a 6.0 favourite in a competitive handicap frames often, wins rarely, and has the
 * tightest spread in the race, so it is regularly the best play. EV decides.
 *
 * Exception: offers with `winnerMustBeSpFavourite` (QuinnBet-style "2nd to SP
 * favourite"). Backing the market favourite can never trigger a place-only clause
 * of that form, so trigger probability for that horse is zero and EV picks a
 * runner that can finish behind the favourite when the favourite wins.
 */

import {
  DEFAULT_MIN_COVERAGE,
  finishPositionProbs,
  winProbsFromRunners,
} from "@/lib/calc/racing/finish-positions";
import { roundPence } from "@/lib/calc/money";
import {
  placeRefundRunnerEv,
  resolveOfferConfidence,
  triggerProbWithFavouriteConstraint,
  type OfferConfidence,
  type TriggerBasis,
} from "@/lib/offers/place-refund-ev";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import {
  offerHasResultTrigger,
  raceQualifiesForOffer,
  type BetGetFreePlaceRules,
} from "@/lib/offers/racing-offer-rules";
import {
  maxTargetPosition,
  offerTargetOutcome,
  type TargetOutcome,
} from "@/lib/offers/target-outcome";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { formatClockTime } from "@/lib/time-format";
import type { RacingDeskRace, RacingRunnerDetail } from "@/lib/racing-desk/types";
import type { OfferRow } from "@/lib/db/schema";

/** Default number of races returned per offer. */
export const DEFAULT_EDGE_LIMIT = 5;

/** Most reasons we will ever show on one line. */
const MAX_REASONS = 3;

/** A favourite at or below this modelled win probability is not "dominant". */
const DOMINANT_FAVOURITE_PROB = 0.4;

/** Qualifying loss below this share of stake counts as cheap. */
const CHEAP_QUAL_LOSS_PCT = 0.02;

/** Beyond the target places, a tail carrying less than this is "thin". */
const THIN_TAIL_MASS = 0.25;

/**
 * Book quality beyond which the normalised probabilities stop deserving a "live"
 * chip. A two-sided Betfair win market normalises within a couple of per cent;
 * anything this far out is stale, thin, or largely one-sided.
 */
const SHARP_OVERROUND_PCT = 15;

/** Below this share of two-sided prices the book is skewed in a way noVig cannot undo. */
const MIN_TWO_SIDED_SHARE = 0.5;

export type { OfferEdgePlay, OfferEdgeRunner } from "@/lib/offers/offer-edge.types";

export interface OfferEdgeOffer {
  id: number;
  title: string;
  bookmaker: string | null;
  rules: BetGetFreePlaceRules;
  /** The raw row, needed for scope matching. Optional in tests. */
  row?: OfferRow;
}

export interface OfferEdgeOptions {
  date: string;
  /** Measured free-bet retention from A1. */
  retention?: number;
  /** How many settled free bets that retention rate rests on. Zero means it is the prior. */
  retentionSampleSize?: number;
  commission?: number;
  /** Maximum races returned. */
  limit?: number;
  /** Minimum share of the field that must be priced before the model is used. */
  minCoverage?: number;
}

interface ScoredRunner {
  detail: RacingRunnerDetail;
  marketRank: number;
  backDecimal: number;
  layDecimal: number;
  positionProbs: number[];
  winProb: number;
}

interface ModelledRace {
  field: ScoredRunner[];
  /** True when the book was complete, two-sided and normalised tightly. */
  bookIsSharp: boolean;
}

/** Decimal odds to two places. Not money, so `roundPence` is the wrong helper. */
function roundOdds(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Best available lay price, falling back to a spread estimate over the bookie price. */
function layPriceFor(runner: RacingRunnerDetail): number | null {
  if (runner.exchangeDecimal != null && runner.exchangeDecimal > 1) return runner.exchangeDecimal;
  const bookie = runner.bookieDecimal ?? runner.spDecimal;
  if (bookie != null && bookie > 1) return roundOdds(bookie * 1.03);
  return null;
}

/** Bookie price the qualifying back bet would actually be struck at. */
function backPriceFor(runner: RacingRunnerDetail): number | null {
  const bookie = runner.bookieDecimal ?? runner.spDecimal;
  if (bookie != null && bookie > 1) return bookie;
  // Free tier with no bookie feed: the exchange back price is the honest stand-in.
  if (runner.exchangeBackDecimal != null && runner.exchangeBackDecimal > 1) {
    return runner.exchangeBackDecimal;
  }
  return null;
}

/**
 * Confidence in a play, from where the prices came from and how well the book
 * behaved when normalised.
 *
 * A race can scrape past the coverage floor on a stale or largely one-sided book
 * and still be tagged "live" by provenance alone, which is exactly the case the
 * user most needs warning about, so book quality can only ever pull the tier down.
 */
function raceConfidence(
  race: RacingDeskRace,
  runner: RacingRunnerDetail,
  bookIsSharp: boolean
): OfferConfidence {
  const provenance = resolveOfferConfidence(
    runner.oddsSource ?? race.oddsSource,
    runner.exchangeSource ?? race.exchangeSource
  );
  if (bookIsSharp || provenance !== "live") return provenance;
  return "mixed";
}

/**
 * Model every active runner in the race, or return null when the race cannot be
 * modelled honestly - either the exchange book is too sparse to normalise, or the
 * offer pays so deep that exact enumeration would cost more than it is worth.
 *
 * Truncating the depth instead would understate the trigger probability of an
 * offer paying past 4th while still reporting itself as a full model result.
 */
function modelRace(
  race: RacingDeskRace,
  target: TargetOutcome,
  minCoverage: number
): ModelledRace | null {
  const active = race.runners.filter((r) => !r.nonRunner);
  if (active.length < 4) return null;

  const book = winProbsFromRunners(active, { minCoverage });
  if (!book) return null;

  const positions = finishPositionProbs(book.probs, { maxPosition: maxTargetPosition(target) });
  if (!positions) return null;
  const { byRunner } = positions;

  const bookIsSharp =
    book.coverage >= 1 &&
    book.twoSidedShare >= MIN_TWO_SIDED_SHARE &&
    Math.abs(book.overroundPct) <= SHARP_OVERROUND_PCT;

  const priced = book.indexes.map((activeIndex, bookIndex) => ({
    detail: active[activeIndex],
    winProb: book.probs[bookIndex],
    positionProbs: byRunner[bookIndex],
  }));

  // Market rank is shortest price first, and is display context only. The model,
  // not the rank, decides which runner is the best target.
  const ranked = [...priced].sort((a, b) => b.winProb - a.winProb);
  const rankByHorse = new Map(ranked.map((r, i) => [r.detail.horseId, i + 1]));

  const scored: ScoredRunner[] = [];
  for (const entry of priced) {
    const backDecimal = backPriceFor(entry.detail);
    const layDecimal = layPriceFor(entry.detail);
    if (backDecimal == null || layDecimal == null) continue;
    scored.push({
      detail: entry.detail,
      marketRank: rankByHorse.get(entry.detail.horseId) ?? priced.length,
      backDecimal,
      layDecimal,
      positionProbs: entry.positionProbs,
      winProb: entry.winProb,
    });
  }

  return scored.length > 0 ? { field: scored, bookIsSharp } : null;
}

function buildReasons(input: {
  race: RacingDeskRace;
  rules: BetGetFreePlaceRules;
  runner: ScoredRunner;
  field: ScoredRunner[];
  qualLoss: number;
  betStake: number;
  target: TargetOutcome;
}): string[] {
  const { race, rules, runner, field, qualLoss, betStake, target } = input;
  const reasons: string[] = [];

  const byWinProb = [...field].sort((a, b) => b.winProb - a.winProb);
  const favourite = byWinProb[0];

  // At exactly minRunners the non-runner warning already owns the field-size
  // story; repeating "Only N runners, the minimum…" next to it reads as a dupe.
  if (race.fieldSize > rules.minRunners && race.fieldSize <= rules.minRunners + 1) {
    reasons.push(`Small ${race.fieldSize}-runner field, fewer horses to beat you`);
  }

  if (favourite && favourite.detail.horseId !== runner.detail.horseId) {
    if (target.winnerMustBeSpFavourite) {
      reasons.push(
        `Needs the ${formatDecimalOdds(favourite.backDecimal)} favourite to win, with you behind them`
      );
    } else if (favourite.winProb >= DOMINANT_FAVOURITE_PROB) {
      reasons.push(
        `The ${formatDecimalOdds(favourite.backDecimal)} favourite should take the win`
      );
    }
  } else if (
    favourite &&
    favourite.detail.horseId === runner.detail.horseId &&
    !target.winnerMustBeSpFavourite
  ) {
    reasons.push("Favourite, but short enough on wins to keep landing in the frame");
  }

  const deepest = maxTargetPosition(target);
  const tailMass = byWinProb.slice(deepest).reduce((total, r) => total + r.winProb, 0);
  if (tailMass > 0 && tailMass < THIN_TAIL_MASS) {
    reasons.push(`Field thins out sharply after ${deepest}th`);
  }

  if (betStake > 0 && Math.abs(qualLoss) / betStake <= CHEAP_QUAL_LOSS_PCT) {
    reasons.push(`Tight lay, qualifying costs ${formatQualLoss(qualLoss)}`);
  }

  return reasons.slice(0, MAX_REASONS);
}

/** Small losses read better in pence, larger ones in pounds. */
function formatQualLoss(qualLoss: number): string {
  const cost = Math.abs(roundPence(qualLoss));
  if (cost < 1) return `${Math.round(cost * 100)}p`;
  return `£${cost.toFixed(2)}`;
}

function buildWarnings(input: {
  race: RacingDeskRace;
  rules: BetGetFreePlaceRules;
  runner: ScoredRunner;
  layStake: number;
  triggerBasis: TriggerBasis;
  bookIsSharp: boolean;
}): string[] {
  const { race, rules, runner, layStake, triggerBasis, bookIsSharp } = input;
  const warnings: string[] = [];

  if (race.fieldSize === rules.minRunners) {
    warnings.push(
      `Exactly ${race.fieldSize} runners, one non-runner and this offer no longer qualifies`
    );
  }

  const available = runner.detail.exchangeLaySize;
  if (available != null && layStake > 0 && available < layStake) {
    warnings.push(`Only £${Math.floor(available)} available at the lay price`);
  }

  // Same fallback `raceConfidence` uses. Reading only the runner would let a
  // "prices are estimates" warning sit next to a green "Live back & lay" chip.
  if ((runner.detail.exchangeSource ?? race.exchangeSource) !== "live") {
    warnings.push("Prices are estimates, no live exchange match for this race");
  } else if (triggerBasis === "heuristic") {
    warnings.push("Too few prices to model this race, showing a rough estimate");
  } else if (!bookIsSharp) {
    warnings.push("Exchange book is patchy here, treat the figure as indicative");
  }

  return warnings;
}

/**
 * Ranked plays for one offer across the supplied races: the best runner in each
 * qualifying race, ordered by expected value.
 */
export function buildOfferEdgePlays(
  offer: OfferEdgeOffer,
  races: RacingDeskRace[],
  opts: OfferEdgeOptions
): OfferEdgePlay[] {
  const { rules } = offer;
  if (!(rules.betStake > 0) || !(rules.freeBetAmount > 0)) return [];
  // Straight bet&get (reward not result-dependent) has no place target to model.
  if (!offerHasResultTrigger(rules)) return [];

  const target = offerTargetOutcome(rules);
  if (target.positions.length === 0) return [];

  const minCoverage = opts.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const plays: OfferEdgePlay[] = [];

  for (const race of races) {
    if (race.status === "finished") continue;
    if (offer.row && !raceQualifiesForOffer(offer.row, race, opts.date).qualifies) continue;
    if (race.fieldSize < rules.minRunners) continue;

    const modelled = modelRace(race, target, minCoverage);
    if (!modelled) continue;
    const { field, bookIsSharp } = modelled;

    let best: OfferEdgePlay | null = null;
    // Ranking compares raw EV, not the rounded figure stored on the play, so the
    // pick never turns on a sub-penny rounding artefact.
    let bestRawEv = Number.NEGATIVE_INFINITY;

    const fieldForConstraint = field.map((r) => ({
      horseId: r.detail.horseId,
      winProb: r.winProb,
    }));

    for (const runner of field) {
      const triggerProb = triggerProbWithFavouriteConstraint({
        selectionHorseId: runner.detail.horseId,
        selectionPositionProbs: runner.positionProbs,
        field: fieldForConstraint,
        target,
      });

      const ev = placeRefundRunnerEv({
        betStake: rules.betStake,
        freeBetAmount: rules.freeBetAmount,
        backOdds: runner.backDecimal,
        layOdds: runner.layDecimal,
        marketRank: runner.marketRank,
        fieldSize: race.fieldSize,
        commission: opts.commission,
        triggerProb,
        retention: opts.retention,
      });

      if (best && ev.totalEv <= bestRawEv) continue;
      bestRawEv = ev.totalEv;

      // Total is the sum of the two rounded parts, not the rounded sum, because
      // the card shows all three and they have to reconcile on screen.
      const qualLoss = roundPence(ev.qualLoss);
      const freeBetEv = roundPence(ev.freeBetEv);
      best = {
        offerId: offer.id,
        offerTitle: offer.title,
        bookmaker: offer.bookmaker,
        raceExternalId: race.externalId,
        course: race.course,
        raceName: race.raceName,
        offTime: race.offTime,
        startTime: race.startTime,
        region: race.region,
        fieldSize: race.fieldSize,
        runner: {
          horseId: runner.detail.horseId,
          name: runner.detail.name,
          backDecimal: runner.backDecimal,
          layDecimal: runner.layDecimal,
          marketRank: runner.marketRank,
        },
        triggerProb: ev.triggerProb,
        triggerBasis: ev.triggerBasis,
        qualLoss,
        layStake: ev.layStake,
        freeBetEv,
        totalEv: roundPence(qualLoss + freeBetEv),
        retention: ev.retention,
        retentionSampleSize: opts.retentionSampleSize ?? 0,
        confidence: raceConfidence(race, runner.detail, bookIsSharp),
        oddsSource: runner.detail.oddsSource ?? race.oddsSource,
        exchangeSource: runner.detail.exchangeSource ?? race.exchangeSource,
        reasons: buildReasons({
          race,
          rules,
          runner,
          field,
          qualLoss,
          betStake: rules.betStake,
          target,
        }),
        warnings: buildWarnings({
          race,
          rules,
          runner,
          layStake: ev.layStake,
          triggerBasis: ev.triggerBasis,
          bookIsSharp,
        }),
      };
    }

    if (best) plays.push(best);
  }

  return plays
    .sort((a, b) => b.totalEv - a.totalEv || a.startTime - b.startTime)
    .slice(0, opts.limit ?? DEFAULT_EDGE_LIMIT);
}

/** One-line summary for Do Next and the offer card. */
export function formatEdgePlaySummary(play: OfferEdgePlay): string {
  const ev = play.totalEv >= 0 ? `+£${play.totalEv.toFixed(2)}` : `-£${Math.abs(play.totalEv).toFixed(2)}`;
  // The off time comes from the epoch, not the racecard's "2:00" string, which
  // carries no am/pm and would read as two in the morning.
  return `${play.course} ${formatClockTime(play.startTime)}, back ${play.runner.name} at ${formatDecimalOdds(play.runner.backDecimal)}, EV ${ev}.`;
}
