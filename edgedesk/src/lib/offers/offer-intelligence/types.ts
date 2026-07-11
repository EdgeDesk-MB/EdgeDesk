import type { OfferCategoryId } from "@/lib/offers/offer-categories";
import type { OfferImportantTerms } from "@/lib/offers/offer-terms";

/** Common matched-betting offer archetypes. */
export type OfferArchetype =
  | "bet_boost"
  | "bet_get_free_bet"
  | "place_refund"
  | "risk_free"
  | "deposit_match"
  | "acca_insurance"
  | "unconditional_free_bet"
  | "extra_place"
  | "unknown";

export type OfferIntelligenceConfidence = "high" | "medium" | "low";

export interface OfferIntelligenceSignals {
  boostPercent: number | null;
  /** Boost applies to winnings (Betfair Bet Boost) vs fixed odds uplift */
  boostOnWinnings: boolean;
  singlesOnly: boolean;
  multisOnly: boolean;
  inPlayAllowed: boolean;
  tokenSingleUse: boolean;
  cashOutVoids: boolean;
  noFreeBetsWithOffer: boolean;
  sportsbookOnly: boolean;
  snrFreeBet: boolean;
  newCustomersOnly: boolean;
  minSelections: number | null;
}

export interface OfferIntelligenceContext {
  text: string;
  bookmaker: string | null;
  category: OfferCategoryId;
  betStake: number | null;
  freeBetAmount: number | null;
  important: OfferImportantTerms;
  qualifyingPlaces: number[];
  expiresAt: number | null;
  isRacing: boolean;
}

export interface OfferIntelligenceResult {
  archetype: OfferArchetype;
  archetypeLabel: string;
  confidence: OfferIntelligenceConfidence;
  signals: OfferIntelligenceSignals;
  expectedProfit: number | null;
  epExplanation: string | null;
  /** Step-by-step matched-betting workflow */
  instructions: string[];
  /** Short bullets for the Important / must-not-miss field */
  importantHints: string[];
}

export interface ArchetypeMatch {
  archetype: OfferArchetype;
  score: number;
}
