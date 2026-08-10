/**
 * Keep racing bet&get titles and rules.qualifyingPlaces aligned.
 *
 * Historical bug: How-to-match note re-parsing sometimes shortened rules
 * (e.g. title "2nd, 3rd, 4th" but rules only [3,4]). Title-wins repair fixed
 * that, but also clobbered deliberate editor saves when the OCR/paste title
 * still listed different places (e.g. "(4th, 6th)" while the user set 2nd +
 * SP favourite).
 *
 * Policy:
 * - Classic corruption: rules are a non-empty proper subset of title places →
 *   restore rules from the title.
 * - Any other mismatch (user edit, OCR title left stale) → rewrite the title
 *   place clause from rules (rules are source of truth after an edit).
 *
 * Pure title helpers live in bet-get-title-places.ts (client-safe).
 */
import { eq } from "drizzle-orm";
import { db, offers, type OfferRow } from "@/lib/db";
import {
  extractPlacesFromBetGetTitle,
  isProperPlaceSubset,
  samePlaces,
  syncBetGetTitleWithPlaces,
} from "@/lib/offers/bet-get-title-places";
import {
  formatBetGetFreePlaceSummary,
  parseOfferRules,
  type BetGetFreePlaceRules,
} from "@/lib/offers/racing-offer-rules";
import { formatImportantTermsSummary, readImportantTerms } from "@/lib/offers/offer-terms";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";

export {
  extractPlacesFromBetGetTitle,
  formatBetGetTitlePlaceClause,
  isProperPlaceSubset,
  syncBetGetTitleWithPlaces,
} from "@/lib/offers/bet-get-title-places";

/** Classic How-to-match corruption: title lists more places than a subset in rules. */
export function offerNeedsTitlePlaceRepair(
  offer: Pick<OfferRow, "title" | "offerType" | "rules">
): boolean {
  if (offer.offerType !== "bet_get_free_place") return false;
  const fromTitle = extractPlacesFromBetGetTitle(offer.title);
  if (fromTitle.length === 0) return false;
  const rules = parseOfferRules(offer as OfferRow);
  if (!rules) return false;
  if (samePlaces(rules.qualifyingPlaces, fromTitle)) return false;
  return isProperPlaceSubset(rules.qualifyingPlaces, fromTitle);
}

/**
 * Title place clause disagrees with rules, but not as subset corruption —
 * typically a stale OCR/paste title after the user edited places in the form.
 */
export function offerNeedsTitleSyncFromRules(
  offer: Pick<OfferRow, "title" | "offerType" | "rules">
): boolean {
  if (offer.offerType !== "bet_get_free_place") return false;
  const rules = parseOfferRules(offer as OfferRow);
  if (!rules) return false;
  const fromTitle = extractPlacesFromBetGetTitle(offer.title);
  if (samePlaces(rules.qualifyingPlaces, fromTitle)) {
    // Places match, but SP-favourite wording may still be missing from the title.
    if (rules.winnerMustBeSpFavourite === true) {
      const paren = offer.title.trim().match(/\(([^)]+)\)\s*$/);
      const inner = paren?.[1] ?? "";
      return !/sp\s+|starting\s+price/i.test(inner);
    }
    return false;
  }
  // Subset corruption is handled by title → rules repair, not title rewrite.
  if (isProperPlaceSubset(rules.qualifyingPlaces, fromTitle)) return false;
  return true;
}

function rewriteDescription(offer: OfferRow, rules: BetGetFreePlaceRules): string {
  const important = formatImportantTermsSummary(readImportantTerms(offer));
  return normalizeOfferDetailsText(
    [formatBetGetFreePlaceSummary(rules), important].filter(Boolean).join(" · ")
  );
}

/**
 * Align title and rules for bet&get place offers.
 * Returns counts for both repair directions.
 */
export function repairMismatchedTitlePlaceRules(): {
  fixed: number;
  titlesSynced: number;
} {
  let fixed = 0;
  let titlesSynced = 0;
  for (const offer of db.select().from(offers).all()) {
    const rules = parseOfferRules(offer);
    if (!rules) continue;

    if (offerNeedsTitlePlaceRepair(offer)) {
      const fromTitle = extractPlacesFromBetGetTitle(offer.title);
      const next: BetGetFreePlaceRules = { ...rules, qualifyingPlaces: fromTitle };
      db.update(offers)
        .set({
          rules: JSON.stringify(next),
          description: rewriteDescription(offer, next),
        })
        .where(eq(offers.id, offer.id))
        .run();
      fixed += 1;
      continue;
    }

    if (offerNeedsTitleSyncFromRules(offer)) {
      const nextTitle = syncBetGetTitleWithPlaces(offer.title, rules.qualifyingPlaces, {
        winnerMustBeSpFavourite: rules.winnerMustBeSpFavourite === true,
      });
      if (nextTitle !== offer.title.trim()) {
        db.update(offers)
          .set({
            title: nextTitle,
            description: rewriteDescription(offer, rules),
          })
          .where(eq(offers.id, offer.id))
          .run();
        titlesSynced += 1;
      }
    }
  }
  return { fixed, titlesSynced };
}
