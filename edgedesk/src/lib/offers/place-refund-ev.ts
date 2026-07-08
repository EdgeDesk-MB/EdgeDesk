import { matchedBet } from "@/lib/calc/matched";
import type { OddsSource } from "@/lib/racing/odds";
import type { ExchangeOddsSource } from "@/lib/services/exchange/types";

export type OfferConfidence = "live" | "mixed" | "estimate";

const FREE_BET_RETENTION = 0.8;
const DEFAULT_COMMISSION = 0.02;

/** Rough P(2nd–4th finish, not winning) from market rank and price. */
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
  if (oddsSource === "proxy") return "estimate";
  if (exchangeSource === "live" && oddsSource === "live") return "live";
  if (exchangeSource === "live" || oddsSource === "live") return "mixed";
  return "estimate";
}

export interface PlaceRefundEvInput {
  betStake: number;
  freeBetAmount: number;
  backOdds: number;
  layOdds: number;
  marketRank: number;
  fieldSize: number;
  commission?: number;
}

export interface PlaceRefundEvResult {
  qualLoss: number;
  layStake: number;
  triggerProb: number;
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
  const triggerProb = estimatePlaceRefundTriggerProb(
    input.marketRank,
    input.fieldSize,
    input.backOdds
  );
  const freeBetEv = triggerProb * input.freeBetAmount * FREE_BET_RETENTION;
  const totalEv = qualLoss + freeBetEv;

  return {
    qualLoss,
    layStake: matched.layStake,
    triggerProb,
    freeBetEv,
    totalEv,
  };
}

export function formatConfidenceLabel(c: OfferConfidence): string {
  switch (c) {
    case "live":
      return "Live odds";
    case "mixed":
      return "Partial live";
    case "estimate":
      return "Proxy estimate";
  }
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
