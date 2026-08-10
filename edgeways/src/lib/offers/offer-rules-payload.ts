/**
 * Build offers.rules JSON from Important terms + playbook (O1).
 */

import type { ParsedOfferDraft } from "@/lib/offers/parse-offer-text";
import {
  buildPromoTermsRules,
  mergeImportantIntoRacingRules,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";
import {
  deriveOfferPlaybook,
  mergePlaybookProgress,
  playbookFactsFromImportant,
  readPlaybookFromRulesJson,
  withPlaybookOnRules,
  type OfferPlaybook,
} from "@/lib/offers/offer-playbook";
import type { BetGetFreePlaceRules } from "@/lib/offers/racing-offer-rules";

export function buildRulesJsonWithPlaybook(input: {
  important: OfferImportantTerms;
  racingRules?: BetGetFreePlaceRules | null;
  betStake?: number | null;
  freeBetAmount?: number | null;
  bookmaker?: string | null;
  previousRulesJson?: string | null;
  playbookOverride?: OfferPlaybook | null;
}): string | null {
  const { important, racingRules, betStake, freeBetAmount, bookmaker } = input;
  const base = racingRules
    ? mergeImportantIntoRacingRules(racingRules, important)
    : buildPromoTermsRules(important);

  const derived =
    input.playbookOverride ??
    deriveOfferPlaybook(
      playbookFactsFromImportant(important, {
        betStake: betStake ?? important.minStake,
        freeBetAmount: freeBetAmount ?? null,
        bookmaker: bookmaker ?? null,
      })
    );

  const previous = readPlaybookFromRulesJson(input.previousRulesJson ?? null);
  const playbook = mergePlaybookProgress(previous, derived);

  if (!base) {
    // Persist playbook-only promo shell when facts exist without classic terms
    if (!important.depositRequired && !important.promoCode && playbook.steps.length === 0) {
      return null;
    }
    return JSON.stringify(
      withPlaybookOnRules(
        {
          type: "promo_terms",
          importantNotes: important.importantNotes.trim() || null,
          promoCode: important.promoCode,
          minDeposit: important.minDeposit,
          depositRequired: important.depositRequired || undefined,
        },
        playbook
      )
    );
  }

  return JSON.stringify(withPlaybookOnRules({ ...base }, playbook));
}

/** Email intake / paste → rules column. */
export function rulesJsonFromParsedDraft(
  draft: ParsedOfferDraft,
  previousRulesJson?: string | null
): string | null {
  return buildRulesJsonWithPlaybook({
    important: draft.important,
    racingRules: draft.rules,
    betStake: draft.betStake,
    freeBetAmount: draft.freeBetAmount,
    bookmaker: draft.bookmaker,
    previousRulesJson,
    playbookOverride: draft.playbook,
  });
}
