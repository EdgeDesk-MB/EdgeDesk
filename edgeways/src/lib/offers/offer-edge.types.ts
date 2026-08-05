/**
 * Offer Edge shapes, kept apart from the engine so the Racing Desk payload types
 * can reference a play without importing the engine itself.
 */

import type { OfferConfidence, TriggerBasis } from "@/lib/offers/place-refund-ev";
import type { OddsSource } from "@/lib/racing/odds";
import type { ExchangeOddsSource } from "@/lib/services/exchange/types";

export interface OfferEdgeRunner {
  horseId: string;
  name: string;
  /** Bookie back price the qualifying bet would be struck at. */
  backDecimal: number;
  /** Exchange lay price the hedge would be struck at. */
  layDecimal: number;
  /** Where this runner sits in the market, shortest price first. Display context only. */
  marketRank: number;
}

export interface OfferEdgePlay {
  offerId: number;
  offerTitle: string;
  bookmaker: string | null;
  raceExternalId: string;
  course: string;
  raceName: string;
  offTime: string;
  startTime: number;
  region?: string;
  fieldSize: number;
  runner: OfferEdgeRunner;
  /** Probability the offer's target result lands. */
  triggerProb: number;
  triggerBasis: TriggerBasis;
  /** Expected qualifying loss, negative pounds. */
  qualLoss: number;
  layStake: number;
  freeBetEv: number;
  totalEv: number;
  /** Free-bet retention rate (0-1) used to scale `freeBetEv`. */
  retention: number;
  /**
   * Settled free bets behind that rate. Zero means the figure rests on the user's
   * configured prior rather than anything they have actually measured.
   */
  retentionSampleSize: number;
  confidence: OfferConfidence;
  /** Bookie/back price provenance for the trust badge. */
  oddsSource?: OddsSource;
  /** Exchange/lay price provenance for the trust badge. */
  exchangeSource?: ExchangeOddsSource;
  /** Why this play is good, in plain English. */
  reasons: string[];
  /** Execution traps the user should see before placing. */
  warnings: string[];
}
