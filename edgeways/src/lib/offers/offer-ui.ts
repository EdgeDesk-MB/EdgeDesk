/** Offer free-bet / title helpers for Offers UI. */

import type { OfferSummary } from "@/lib/services/offers.types";
import { parseOfferRules } from "@/lib/offers/racing-offer-rules";

function titleImpliesFreeBetReward(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (/\b£\s*\d+(?:\.\d{1,2})?\s*(?:free\s*bet|fb)\b/i.test(t)) return true;
  if (/\bbet\s+£?\s*\d+.*\bget\b.*\bfree\s*bet\b/i.test(t)) return true;
  if (/\bget\s+£\s*\d+(?:\.\d{1,2})?\b/i.test(t) && /\bfree\s*bet\b/i.test(t)) return true;
  return false;
}

/** True when this offer's reward is a free bet (not money-back, cashback, etc.). */
export function offerHasFreeBetReward(offer: OfferSummary): boolean {
  const { profit } = offer;

  if (profit.freeBetAwarded || (profit.freeBetAwardAmount != null && profit.freeBetAwardAmount > 0)) {
    return true;
  }
  if (
    profit.freeBetStage === "awarded" ||
    profit.freeBetStage === "in_use" ||
    profit.freeBetStage === "settled" ||
    profit.freeBetStage === "awaiting_result"
  ) {
    return true;
  }

  const rules = parseOfferRules(offer);
  if (rules?.freeBetAmount != null && rules.freeBetAmount > 0) return true;
  if (offer.offerType === "bet_get_free_place" && rules) return true;

  return titleImpliesFreeBetReward(offer.title);
}

/** Free bet £ amount if known from rules / profit / title. */
export function offerFreeBetAmount(offer: OfferSummary): number | null {
  if (!offerHasFreeBetReward(offer)) return null;

  if (offer.profit.freeBetAwardAmount != null && offer.profit.freeBetAwardAmount > 0) {
    return offer.profit.freeBetAwardAmount;
  }
  const rules = parseOfferRules(offer);
  if (rules?.freeBetAmount) return rules.freeBetAmount;
  const m = offer.title.match(/£\s*(\d+(?:\.\d{1,2})?)\s*(?:free\s*bet|fb)/i);
  if (m) return parseFloat(m[1]);
  const m2 = offer.title.match(/get\s+£\s*(\d+(?:\.\d{1,2})?)/i);
  if (m2 && /\bfree/i.test(offer.title)) return parseFloat(m2[1]);
  return null;
}
