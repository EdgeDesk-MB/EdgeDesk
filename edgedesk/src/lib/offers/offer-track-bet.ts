import type { AddBetPrefill } from "@/components/add-bet-dialog";
import type { BetMode } from "@/lib/calc";
import { deriveOfferNextAction } from "@/lib/offers/next-actions";
import { parseOfferRules, placeRefundTriggerText } from "@/lib/offers/racing-offer-rules";
import {
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
  type AppSettings,
} from "@/lib/services/settings-shared";
import type { OfferSummary } from "@/lib/services/offers.types";

function ctaLabelForAction(
  action: ReturnType<typeof deriveOfferNextAction>,
  betType: BetMode,
  enabled: boolean
): string {
  if (!enabled && action?.title) return action.title;
  if (action?.kind === "convert_free_bet" || betType === "free_snr") {
    return "Convert free bet";
  }
  if (action?.kind === "start_planned") return "Start campaign";
  if (action?.kind === "place_qualifying" || action?.kind === "review_expiry") {
    return "Place qualifying bet";
  }
  if (betType === "free_snr") return "Convert free bet";
  return "Place qualifying bet";
}

export interface TrackBetAction {
  enabled: boolean;
  label: string;
  reason: string | null;
  prefill: AddBetPrefill | null;
}

/** Build Add bet prefill for the campaign's current pipeline step. */
export function deriveTrackBetAction(
  offer: OfferSummary,
  settings?: Pick<AppSettings, "offerBetPrefs" | "defaultBackStake"> | null
): TrackBetAction {
  const prefs = settings?.offerBetPrefs ?? {};
  const defaultStake = settings?.defaultBackStake ?? 10;
  const rules = offer.sport === "horse_racing" ? parseOfferRules(offer) : null;
  const action = deriveOfferNextAction(offer);
  const profit = offer.profit;

  if (offer.status === "completed" || offer.status === "expired") {
    return {
      enabled: false,
      label: offer.status === "completed" ? "Campaign complete" : "Campaign expired",
      reason: "This campaign is finished.",
      prefill: null,
    };
  }

  if (profit.qualifyingOpenCount > 0) {
    return {
      enabled: false,
      label: ctaLabelForAction(action, "qualifying", false),
      reason:
        action?.detail ??
        "Qualifying bet is still open — settle when the result lands.",
      prefill: null,
    };
  }

  if (profit.freeBetStage === "in_use" || profit.freeBetStage === "awaiting_result") {
    return {
      enabled: false,
      label: ctaLabelForAction(action, "free_snr", false),
      reason: action?.detail ?? "Awaiting result on an open bet.",
      prefill: null,
    };
  }

  let betType: BetMode = "qualifying";
  let stakeSource: number | null | undefined = rules?.betStake;
  let label = ctaLabelForAction(action, "qualifying", true);

  if (profit.freeBetStage === "awarded" || action?.kind === "convert_free_bet") {
    betType = "free_snr";
    stakeSource = profit.freeBetAwardAmount ?? rules?.freeBetAmount ?? null;
    label = ctaLabelForAction(action, "free_snr", true);
  } else if (
    action?.kind === "place_qualifying" ||
    action?.kind === "start_planned" ||
    (offer.betCount === 0 && profit.freeBetStage === "none")
  ) {
    betType = "qualifying";
    label = ctaLabelForAction(action, "qualifying", true);
  } else if (action?.kind === "review_expiry" && offer.betCount === 0) {
    betType = "qualifying";
    label = ctaLabelForAction(action, "qualifying", true);
  } else {
    return {
      enabled: false,
      label: ctaLabelForAction(action, "qualifying", false),
      reason: action?.detail ?? "Nothing to log at this campaign step.",
      prefill: null,
    };
  }

  const stake = stakeFromOfferPrefs(prefs, offer.id, stakeSource, defaultStake);
  const bookmaker =
    bookmakerFromOfferPrefs(prefs, offer.id, offer.bookmaker, "") || undefined;

  const prefill: AddBetPrefill = {
    offerId: offer.id,
    betType,
    backStake: stake,
    bookmaker,
    sport: offer.sport ?? undefined,
    labelSuggestion:
      betType === "free_snr"
        ? `Convert FB · ${bookmaker ?? offer.title}`
        : `Qualify · ${bookmaker ?? offer.title}`,
  };

  if (rules && betType === "qualifying") {
    prefill.triggerText = placeRefundTriggerText(rules);
  }

  if (offer.sport === "horse_racing") {
    prefill.sport = "horse_racing";
    prefill.market = "win";
    if (offer.scopeRaceLabel?.trim()) {
      const course = offer.scopeCourse?.trim();
      prefill.labelSuggestion = course
        ? `${course} · ${offer.scopeRaceLabel.trim()}`
        : offer.scopeRaceLabel.trim();
    }
  }

  return { enabled: true, label, reason: null, prefill };
}
