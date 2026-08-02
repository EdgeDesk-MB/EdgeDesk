import { offerCategoryById } from "@/lib/offers/offer-categories";
import { formatQualifyingPlacesPhrase } from "@/lib/offers/offer-odds-text";
import { formatClockTime } from "@/lib/time-format";
import type {
  ArchetypeMatch,
  OfferArchetype,
  OfferIntelligenceContext,
  OfferIntelligenceSignals,
} from "./types";
import {
  estimateAccaInsuranceEv,
  estimateBetGetEv,
  estimateBoostWinningsEv,
  estimateDepositMatchEv,
  estimateFreeBetEv,
  estimatePlaceRefundEv,
  estimateRiskFreeEv,
  FREE_BET_EV_RETENTION,
} from "./estimates";

const ARCHETYPE_LABELS: Record<OfferArchetype, string> = {
  bet_boost: "Bet boost / odds boost",
  bet_get_free_bet: "Bet & get free bet",
  place_refund: "Place refund (racing)",
  risk_free: "Risk-free / money back",
  deposit_match: "Deposit match",
  acca_insurance: "Acca insurance",
  unconditional_free_bet: "Free bet token",
  extra_place: "Extra place",
  unknown: "General offer",
};

export function archetypeLabel(archetype: OfferArchetype): string {
  return ARCHETYPE_LABELS[archetype];
}

/** Score pasted text against each archetype; highest wins. */
export function classifyOfferArchetype(
  text: string,
  ctx: Pick<
    OfferIntelligenceContext,
    "betStake" | "freeBetAmount" | "qualifyingPlaces" | "isRacing"
  > & { signals: OfferIntelligenceSignals }
): ArchetypeMatch {
  const { betStake, freeBetAmount, qualifyingPlaces, isRacing } = ctx;
  const signals = ctx.signals;
  const scores: ArchetypeMatch[] = [];

  const boostScore =
    (signals.boostPercent != null ? 4 : 0) +
    (/\bbet\s+boost\b/i.test(text) ? 3 : 0) +
    (/\bboost\s+(?:your|the)\s+(?:single|bet)\b/i.test(text) ? 3 : 0) +
    (/\b\d+\s*%\s+boost\b/i.test(text) ? 2 : 0) +
    (/\bwinnings?\s+boost\b/i.test(text) ? 2 : 0);
  scores.push({ archetype: "bet_boost", score: boostScore });

  const betGetScore =
    (betStake != null && freeBetAmount != null ? 5 : 0) +
    (/\bbet\s+£?\d+\s+get\s+£?\d+/i.test(text) ? 4 : 0) +
    (/\bqualifying\s+bet\b/i.test(text) && freeBetAmount != null ? 2 : 0);
  scores.push({ archetype: "bet_get_free_bet", score: betGetScore });

  const placeScore =
    (isRacing && qualifyingPlaces.length > 0 ? 5 : 0) +
    (/\bmoney\s+back\b/i.test(text) && qualifyingPlaces.length > 0 ? 4 : 0) +
    (isRacing &&
    /\b(?:2nd|3rd|4th)\b/i.test(text) &&
    /\b(?:back|refund|free\s*bet)\b/i.test(text)
      ? 2
      : 0) +
    (/\bif\s+(?:your\s+)?horse\s+finishes?\b/i.test(text) ? 3 : 0);
  scores.push({ archetype: "place_refund", score: placeScore });

  const riskFreeScore =
    (/\brisk[- ]?free\b/i.test(text) ? 4 : 0) +
    (/\bmoney\s+back\s+if\s+(?:your\s+)?(?:bet\s+)?los/i.test(text) ? 4 : 0) +
    (/\brefund(?:ed)?\s+as\s+(?:a\s+)?free\s*bet\b/i.test(text) ? 3 : 0) +
    (/\bget\s+your\s+stake\s+back\b/i.test(text) ? 2 : 0);
  scores.push({ archetype: "risk_free", score: riskFreeScore });

  const depositScore =
    (/\bdeposit\s+match\b/i.test(text) ? 5 : 0) +
    (/\b\d+\s*%\s+(?:deposit\s+)?bonus\b/i.test(text) ? 3 : 0) +
    (/\bmatched\s+(?:deposit|bonus)\b/i.test(text) ? 3 : 0);
  scores.push({ archetype: "deposit_match", score: depositScore });

  const accaScore =
    (/\bacca\s+insurance\b/i.test(text) ? 5 : 0) +
    (/\bone\s+leg\s+lets?\s+you\s+down\b/i.test(text) ? 4 : 0) +
    (/\baccumulator\s+insurance\b/i.test(text) ? 4 : 0);
  scores.push({ archetype: "acca_insurance", score: accaScore });

  const freeOnlyScore =
    (freeBetAmount != null && betStake == null ? 3 : 0) +
    (/\bfree\s*bet\s+token\b/i.test(text) ? 3 : 0) +
    (/(?:£\s*\d+|\d+\s*£)\s*(?:in\s+)?free\s*bets?\b/i.test(text) && betStake == null ? 3 : 0) +
    (/\b£\s*\d+(?:\.\d+)?\s+free\s*bet\b/i.test(text) && betStake == null ? 3 : 0);
  scores.push({ archetype: "unconditional_free_bet", score: freeOnlyScore });

  const extraPlaceScore =
    (/\bextra\s+place\b/i.test(text) ? 5 : 0) +
    (/\b\d+\s+places?\s+instead\s+of\s+\d+\b/i.test(text) ? 4 : 0);
  scores.push({ archetype: "extra_place", score: extraPlaceScore });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score < 2) return { archetype: "unknown", score: 0 };
  return best;
}

export function buildExpectedProfit(
  archetype: OfferArchetype,
  ctx: OfferIntelligenceContext,
  signals: OfferIntelligenceSignals
): { profit: number | null; explanation: string | null } {
  const { betStake, freeBetAmount, important, qualifyingPlaces } = ctx;

  switch (archetype) {
    case "bet_boost": {
      const maxStake = important.maxStake ?? betStake;
      const minOdds = important.minOdds ?? 2;
      const boost = signals.boostPercent;
      if (maxStake == null || boost == null) {
        return { profit: null, explanation: null };
      }
      const profit = estimateBoostWinningsEv({
        maxStake,
        minOdds,
        boostPercent: boost,
      });
      return {
        profit,
        explanation: `Est. ~£${profit} (${boost}% boost on £${maxStake} at min odds ${minOdds}, underlay play)`,
      };
    }
    case "bet_get_free_bet": {
      const profit = estimateBetGetEv(betStake, freeBetAmount, important.minOdds);
      if (profit == null) return { profit: null, explanation: null };
      return {
        profit,
        explanation: `Est. ~£${profit} (${Math.round(FREE_BET_EV_RETENTION * 100)}% of £${freeBetAmount} free bet minus qual loss)`,
      };
    }
    case "place_refund": {
      const simpleFb = estimateFreeBetEv(freeBetAmount);
      const modelled = estimatePlaceRefundEv(
        betStake,
        freeBetAmount,
        qualifyingPlaces.length || 3
      );
      const profit = simpleFb ?? modelled;
      if (profit == null) return { profit: null, explanation: null };
      return {
        profit,
        explanation:
          simpleFb != null && modelled != null && simpleFb > modelled
            ? `Est. ~£${profit} (${Math.round(FREE_BET_EV_RETENTION * 100)}% SNR extraction; refine on racing desk)`
            : `Est. ~£${profit} (place-trigger refund, proxy odds)`,
      };
    }
    case "risk_free": {
      const profit = estimateRiskFreeEv(betStake, freeBetAmount ?? betStake);
      if (profit == null) return { profit: null, explanation: null };
      return {
        profit,
        explanation: `Est. ~£${profit} (refund as SNR free bet)`,
      };
    }
    case "deposit_match": {
      const profit = estimateDepositMatchEv(freeBetAmount ?? betStake);
      if (profit == null) return { profit: null, explanation: null };
      return {
        profit,
        explanation: `Est. ~£${profit} (deposit match, wagering assumed)`,
      };
    }
    case "acca_insurance": {
      const profit = estimateAccaInsuranceEv(betStake ?? important.maxStake);
      if (profit == null) return { profit: null, explanation: null };
      return {
        profit,
        explanation: `Est. ~£${profit} (acca insurance, rough)`,
      };
    }
    case "unconditional_free_bet": {
      const profit = estimateFreeBetEv(freeBetAmount);
      if (profit == null) return { profit: null, explanation: null };
      return {
        profit,
        explanation: `Est. ~£${profit} (${Math.round(FREE_BET_EV_RETENTION * 100)}% SNR extraction)`,
      };
    }
    default:
      return { profit: null, explanation: null };
  }
}

export function buildInstructions(
  archetype: OfferArchetype,
  ctx: OfferIntelligenceContext,
  signals: OfferIntelligenceSignals
): string[] {
  const { important, category, bookmaker } = ctx;
  const sport = offerCategoryById(category).label;
  const bookie = bookmaker ?? "the bookie";
  const minOdds = important.minOdds;
  const maxStake = important.maxStake;
  const boost = signals.boostPercent;

  switch (archetype) {
    case "bet_boost":
      return [
        `Find an eligible ${sport !== "General" ? sport.toLowerCase() + " " : ""}single${minOdds != null ? ` at odds ${minOdds}+` : ""}.`,
        `Apply the boost token in the bet slip on ${bookie}${maxStake != null ? ` (max £${maxStake})` : ""}.`,
        "Lay the same selection on the exchange at similar odds.",
        "Use an underlay so £0 if the back loses - profit rides on the boosted win.",
        "Do not cash out; avoid combining with free bets.",
      ].filter(Boolean);

    case "bet_get_free_bet":
      return [
        `Place qualifying cash bet${ctx.betStake != null ? ` of £${ctx.betStake}` : ""} on ${bookie}${minOdds != null ? ` at min odds ${minOdds}` : ""}.`,
        "Pick a market with the closest back/lay match to keep qualifying loss tiny.",
        "Lay the same selection on the exchange at nearly the same odds.",
        `When the free bet lands, extract it SNR on ${bookie}: back at reasonably high odds and lay close to that price for best retention.`,
        signals.snrFreeBet ? "Free bet is SNR - higher matched odds improve extraction." : "",
      ].filter((s) => s.length > 0);

    case "place_refund":
      return [
        `Pick a runner in a suitable race (${ctx.qualifyingPlaces.length > 0 ? `refund if ${formatQualifyingPlacesPhrase(ctx.qualifyingPlaces)}` : "place refund"}).`,
        `Back win (or EW if allowed) on ${bookie}; lay win on the exchange.`,
        "Target a small qualifying loss - EV comes from the place-triggered free bet.",
        "Check min runners and opt-in before betting.",
      ];

    case "risk_free":
      return [
        `Place first cash bet on ${bookie}${ctx.betStake != null ? ` (£${ctx.betStake})` : ""}.`,
        "Lay to minimise qualifying loss (often near £0 on close odds).",
        "If it loses, extract the refund as an SNR free bet.",
      ];

    case "deposit_match":
      return [
        "Check wagering requirements before depositing.",
        "Low-variance casino/sports strategy depends on game weighting.",
        "Track remaining wagering in the offer notes.",
      ];

    case "acca_insurance":
      return [
        "Build acca meeting min legs/odds; back on bookie.",
        "Lay each leg individually (sequential or pre-match).",
        "Insurance pays if one leg fails - model EV before staking up.",
      ];

    case "unconditional_free_bet":
      return [
        `Use the £${ctx.freeBetAmount ?? "?"} free bet SNR on ${bookie}.`,
        "Lay at high odds (4.0+) on the exchange for ~75-80% extraction.",
      ];

    case "extra_place":
      return [
        "Back EW on the bookie extra-place market.",
        "Lay the win only on the exchange (or win + place if covering).",
        "Profit from the extra place terms vs standard place count.",
      ];

    default:
      return [];
  }
}

export function buildImportantHints(
  archetype: OfferArchetype,
  ctx: OfferIntelligenceContext,
  signals: OfferIntelligenceSignals
): string[] {
  const hints: string[] = [];

  if (signals.singlesOnly) hints.push("Singles only");
  if (signals.multisOnly) hints.push("Accas / multis only");
  if (signals.tokenSingleUse) hints.push("One bet per token");
  if (signals.cashOutVoids) hints.push("Cash out voids offer");
  if (signals.noFreeBetsWithOffer) hints.push("No free bets with this promo");
  if (signals.sportsbookOnly) hints.push("Sportsbook only");
  if (signals.newCustomersOnly) hints.push("New customers only");
  if (signals.snrFreeBet && archetype !== "bet_boost") hints.push("SNR free bet");
  if (signals.minSelections != null) hints.push(`Min ${signals.minSelections} selections`);
  if (signals.inPlayAllowed) hints.push("In-play OK");

  if (archetype === "bet_boost" && signals.boostPercent != null) {
    hints.push(`${signals.boostPercent}% winnings boost`);
  }

  if (ctx.expiresAt != null) {
    const d = new Date(ctx.expiresAt);
    const when = `${d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    })}, ${formatClockTime(d)}`;
    hints.push(`Expires ${when}`);
  }

  return hints;
}
