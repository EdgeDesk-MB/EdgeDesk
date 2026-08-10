import { matchedBet } from "@/lib/calc/matched";
import {
  finishPositionProbs,
  sumPositions,
} from "@/lib/calc/racing/finish-positions";
import type { TargetOutcome } from "@/lib/offers/target-outcome";
import { maxTargetPosition } from "@/lib/offers/target-outcome";
import type { OddsSource } from "@/lib/racing/odds";
import type { ExchangeOddsSource } from "@/lib/services/exchange/types";

export type OfferConfidence = "live" | "mixed" | "estimate";

/** Where a trigger probability came from - the model, or the rank heuristic. */
export type TriggerBasis = "model" | "heuristic";

const FREE_BET_RETENTION = 0.8;
const DEFAULT_COMMISSION = 0.02;

/**
 * Rough P(2nd–4th finish, not winning) from market rank and price.
 *
 * The degraded fallback for when the exchange book is too sparse to model, which
 * is the normal case on the free Racing API tier. Prefer `triggerProbFromModel`.
 */
export function estimatePlaceRefundTriggerProb(
  marketRank: number,
  fieldSize: number,
  decimalOdds: number
): number {
  if (marketRank < 2 || marketRank > 6) return 0.04;
  const winProb = 1 / decimalOdds;
  const places = fieldSize >= 16 ? 4 : fieldSize >= 8 ? 3 : 2;
  const placeMultiplier = places === 4 ? 3.2 : places === 3 ? 2.6 : 2;
  let base = Math.min(0.55, winProb * placeMultiplier);

  if (marketRank === 2) base *= 1.35;
  else if (marketRank === 3) base *= 1.15;
  else if (marketRank === 4) base *= 1.05;
  else base *= 0.75;

  return Math.max(0.03, Math.min(0.45, base));
}

export function resolveOfferConfidence(
  oddsSource?: OddsSource,
  exchangeSource?: ExchangeOddsSource
): OfferConfidence {
  // Manual prices are never fully live, even when the other side is.
  if (oddsSource === "manual") return "mixed";
  const backLive = oddsSource === "live";
  const layLive = exchangeSource === "live";
  if (backLive && layLive) return "live";
  // One live side (including live lay with proxy/snapshot back) is "mixed".
  if (backLive || layLive) return "mixed";
  return "estimate";
}

/**
 * P(the offer triggers) from the finishing-position model.
 *
 * `positionProbs` is one runner's row from `finishPositionProbs`, so the sum picks
 * out exactly the positions the offer pays on. A win counts only when the offer
 * says it does, which for a place-refund consolation it does not.
 */
export function triggerProbFromModel(
  positionProbs: number[],
  target: TargetOutcome
): number {
  return sumPositions(positionProbs, target.positions);
}

export interface FavouriteConstraintFieldRunner {
  horseId: string;
  winProb: number;
}

/**
 * P(offer triggers), honouring QuinnBet-style "places to the SP favourite".
 *
 * Before the off we use the market favourite (highest modelled win probability)
 * as the SP-favourite proxy. Backing that horse can never pay a place-only
 * SP-favourite clause: if it wins the winner is the fav but the selection did
 * not place; if it places, the winner was not the fav.
 *
 * For every other runner: P(fav wins) × Harville P(selection in target places |
 * fav already taken the win). Target place k overall becomes place k−1 among
 * the remaining field.
 */
export function triggerProbWithFavouriteConstraint(input: {
  selectionHorseId: string;
  selectionPositionProbs: number[];
  field: FavouriteConstraintFieldRunner[];
  target: TargetOutcome;
}): number {
  const { selectionHorseId, selectionPositionProbs, field, target } = input;

  if (!target.winnerMustBeSpFavourite) {
    return triggerProbFromModel(selectionPositionProbs, target);
  }

  if (field.length < 2 || target.positions.length === 0) return 0;

  let fav = field[0]!;
  for (const runner of field) {
    if (runner.winProb > fav.winProb) fav = runner;
  }

  const isFavourite = selectionHorseId === fav.horseId;
  if (isFavourite) {
    // Only a win-qualifying clause can fire for the favourite itself.
    return target.positions.includes(1) ? Math.max(0, Math.min(1, fav.winProb)) : 0;
  }

  const remapped = target.positions.filter((p) => p >= 2).map((p) => p - 1);
  if (remapped.length === 0) return 0;

  const remaining = field.filter((r) => r.horseId !== fav.horseId);
  const selectionIndex = remaining.findIndex((r) => r.horseId === selectionHorseId);
  if (selectionIndex < 0) return 0;

  const maxPos = Math.max(...remapped, maxTargetPosition(target) - 1);
  const conditional = finishPositionProbs(
    remaining.map((r) => r.winProb),
    { maxPosition: Math.max(1, maxPos) }
  );
  if (!conditional) {
    // First-order fallback when enumeration is refused: scale the unconditional
    // place mass by P(fav wins). Overstates slightly vs the joint, but keeps the
    // favourite at zero and never invents a place for the fav.
    return triggerProbFromModel(selectionPositionProbs, {
      ...target,
      positions: target.positions.filter((p) => p >= 2),
    }) * fav.winProb;
  }

  const placeGivenFavWins = sumPositions(
    conditional.byRunner[selectionIndex]!,
    remapped
  );
  return Math.max(0, Math.min(1, fav.winProb * placeGivenFavWins));
}

export interface PlaceRefundEvInput {
  betStake: number;
  freeBetAmount: number;
  backOdds: number;
  layOdds: number;
  marketRank: number;
  fieldSize: number;
  commission?: number;
  /** Modelled trigger probability. Falls back to the rank heuristic when absent. */
  triggerProb?: number;
  /** Measured free-bet retention (A1). Defaults to the 0.8 prior. */
  retention?: number;
}

export interface PlaceRefundEvResult {
  qualLoss: number;
  layStake: number;
  triggerProb: number;
  triggerBasis: TriggerBasis;
  /** The retention rate actually applied, so callers need not re-derive the default. */
  retention: number;
  freeBetEv: number;
  totalEv: number;
}

/** Expected value of a place-refund qualifying bet on a specific runner. */
export function placeRefundRunnerEv(input: PlaceRefundEvInput): PlaceRefundEvResult {
  const commission = input.commission ?? DEFAULT_COMMISSION;
  const matched = matchedBet({
    mode: "qualifying",
    backStake: input.betStake,
    backOdds: input.backOdds,
    layOdds: input.layOdds,
    commission,
  });

  const qualLoss = matched.guaranteed;
  const modelled = input.triggerProb != null && Number.isFinite(input.triggerProb);
  const triggerProb = modelled
    ? Math.max(0, Math.min(1, input.triggerProb!))
    : estimatePlaceRefundTriggerProb(input.marketRank, input.fieldSize, input.backOdds);
  const retention = input.retention ?? FREE_BET_RETENTION;
  const freeBetEv = triggerProb * input.freeBetAmount * retention;
  const totalEv = qualLoss + freeBetEv;

  return {
    qualLoss,
    layStake: matched.layStake,
    triggerProb,
    triggerBasis: modelled ? "model" : "heuristic",
    retention,
    freeBetEv,
    totalEv,
  };
}

/** Filter-chip wording for the three confidence tiers. */
export function formatConfidenceLabel(c: OfferConfidence): string {
  switch (c) {
    case "live":
      return "Live back & lay";
    case "mixed":
      return "One side live";
    case "estimate":
      return "Estimated";
  }
}

/**
 * What the user can trust about the prices on a play.
 *
 * Prefers per-side provenance when present; falls back to the tier label when
 * only a confidence bucket is known (e.g. filter chips, demoted races).
 */
export function formatPriceTrustLabel(
  oddsSource?: OddsSource,
  exchangeSource?: ExchangeOddsSource,
  confidence?: OfferConfidence
): string {
  if (oddsSource === "manual") return "Your prices";

  const backLive = oddsSource === "live";
  const layLive = exchangeSource === "live";
  if (backLive && layLive) return "Live back & lay";
  if (layLive) return "Live lay only";
  if (backLive) return "Live back only";

  if (confidence) return formatConfidenceLabel(confidence);
  return "Estimated";
}

export function formatOddsSourceLabel(
  source?: OddsSource,
  dataSource?: "demo" | "racing-api" | "error"
): string {
  if (dataSource === "demo") return "Demo";
  switch (source) {
    case "live":
      return "Live odds";
    case "snapshot":
      return "Snapshot";
    case "manual":
      return "Manual override";
    case "proxy":
      return "Proxy estimate";
    default:
      return "Unavailable";
  }
}

export function confidenceTierOrder(c: OfferConfidence): number {
  switch (c) {
    case "live":
      return 0;
    case "mixed":
      return 1;
    case "estimate":
      return 2;
  }
}
