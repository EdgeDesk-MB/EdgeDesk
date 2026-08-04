/**
 * Repair racing offers where the editor invented qualifying places 2–4 on a
 * straight bet & get (reward not result-dependent).
 *
 * Fingerprint: title is the unconditional "Bet £X get £Y free bet" form (no
 * place parenthetical), but rules still carry place targets, so Best plays and
 * "favourite / in the frame" copy appear incorrectly.
 */
import { eq } from "drizzle-orm";
import { db, offers, type OfferRow } from "@/lib/db";
import {
  formatBetGetFreePlaceSummary,
  offerHasResultTrigger,
  parseOfferRules,
  type BetGetFreePlaceRules,
} from "@/lib/offers/racing-offer-rules";
import { formatImportantTermsSummary, readImportantTerms } from "@/lib/offers/offer-terms";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";

/** Exact paste/editor title for unconditional racing bet & get. */
const UNCONDITIONAL_BET_GET_TITLE =
  /^Bet £\d+(?:\.\d+)? get £\d+(?:\.\d+)? free bet$/i;

export function offerNeedsInventedPlaceRepair(offer: Pick<OfferRow, "title" | "offerType" | "rules">): boolean {
  if (offer.offerType !== "bet_get_free_place") return false;
  if (!UNCONDITIONAL_BET_GET_TITLE.test(offer.title.trim())) return false;
  const rules = parseOfferRules(offer as OfferRow);
  return offerHasResultTrigger(rules);
}

function stripInventedPlaces(rules: BetGetFreePlaceRules): BetGetFreePlaceRules {
  const { winnerMustBeSpFavourite: _drop, ...rest } = rules;
  return { ...rest, qualifyingPlaces: [] };
}

function rewriteDescription(offer: OfferRow, rules: BetGetFreePlaceRules): string {
  const important = formatImportantTermsSummary(readImportantTerms(offer));
  return normalizeOfferDetailsText(
    [formatBetGetFreePlaceSummary(rules), important].filter(Boolean).join(" · ")
  );
}

/** Clear invented place targets on unconditional bet & get offers. */
export function repairInventedPlaceRulesOnUnconditionalOffers(): { fixed: number } {
  let fixed = 0;
  for (const offer of db.select().from(offers).all()) {
    if (!offerNeedsInventedPlaceRepair(offer)) continue;
    const rules = parseOfferRules(offer);
    if (!rules) continue;
    const next = stripInventedPlaces(rules);
    db.update(offers)
      .set({
        rules: JSON.stringify(next),
        description: rewriteDescription(offer, next),
      })
      .where(eq(offers.id, offer.id))
      .run();
    fixed += 1;
  }
  return { fixed };
}
