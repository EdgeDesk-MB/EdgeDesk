import type { OfferSummary } from "@/lib/services/offers.types";
import type { BookmakerHealth } from "@/lib/accounts/bookmaker-stats";
import { deriveOfferNextAction, type OfferNextAction } from "@/lib/offers/next-actions";
import { parseOfferRules } from "@/lib/offers/racing-offer-rules";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";

/** Typical cash retention when converting an SNR free bet (fallback when no measured rate). */
const DEFAULT_FREE_BET_RETENTION = 0.8;

/** Gubbed bookies sink to the bottom of rankings but are never hidden (B9). */
const GUBBED_SCORE_MULTIPLIER = 0.1;

export type EvBasis = "live" | "estimated" | "heuristic";

export interface AdvantageOpts {
  /** Measured (or blended) free-bet retention rate. Defaults to 0.8. */
  retention?: number;
  /** Number of conversion bets behind the retention rate (≥5 upgrades basis to "estimated"). */
  retentionSampleSize?: number;
  /** Normalised bookie name → effective health; gubbed multiplies score by 0.1. */
  bookmakerHealth?: Map<string, BookmakerHealth>;
}

export interface OfferAdvantageScore {
  offerId: number;
  offerTitle: string;
  bookmaker: string | null;
  /** Estimated remaining £ edge still on the table */
  remainingEv: number;
  /** How the EV was derived */
  basis: EvBasis;
  /** Urgency boost 0–1 from expiry proximity */
  urgency: number;
  /** Combined rank score (higher = better to do next) */
  score: number;
  reason: string;
  nextAction: OfferNextAction | null;
  /** Effective bookie health when a health map was supplied */
  health: BookmakerHealth;
}

function daysUntil(expiresAt: number | null, now: number): number | null {
  if (expiresAt == null) return null;
  return (expiresAt - now) / (24 * 60 * 60 * 1000);
}

function urgencyFromExpiry(expiresAt: number | null, now: number): number {
  const days = daysUntil(expiresAt, now);
  if (days == null || days < 0) return 0;
  if (days <= 1) return 1;
  if (days <= 3) return 0.7;
  if (days <= 7) return 0.35;
  return 0.1;
}

/**
 * Estimate remaining expected value still available on this offer campaign.
 * Uses free-bet award amount, racing rules, expectedProfit, or open bet EV.
 * Returns a `basis` field indicating how confident the estimate is.
 */
export function estimateOfferRemainingEv(offer: OfferSummary, opts?: AdvantageOpts): {
  remainingEv: number;
  reason: string;
  basis: EvBasis;
} {
  const retention = opts?.retention ?? DEFAULT_FREE_BET_RETENTION;
  const isMeasured = (opts?.retentionSampleSize ?? 0) >= 5;
  const { profit } = offer;

  if (profit.freeBetStage === "awarded" && profit.freeBetAwardAmount != null) {
    const ev = profit.freeBetAwardAmount * retention;
    return {
      remainingEv: ev,
      reason: `~£${ev.toFixed(0)} retained from £${profit.freeBetAwardAmount.toFixed(0)} free bet`,
      basis: isMeasured ? "estimated" : "heuristic",
    };
  }

  if (profit.freeBetStage === "in_use") {
    // Conversion already placed - remaining EV is locked in, not a to-do.
    return {
      remainingEv: 0,
      reason: "Free-bet conversion open - waiting on result",
      basis: "estimated",
    };
  }

  const rules = parseOfferRules(offer);
  if (rules && profit.freeBetStage === "none" && profit.qualifyingSettledCount === 0) {
    const rough = rules.freeBetAmount * retention * 0.35 + (offer.expectedProfit ?? 0);
    // Place-refund: partial probability of award; prefer explicit expectedProfit when set
    const remainingEv =
      offer.expectedProfit != null && Math.abs(offer.expectedProfit) > 0.01
        ? offer.expectedProfit
        : Math.max(rough, 0);
    return {
      remainingEv,
      reason:
        offer.expectedProfit != null
          ? `£${offer.expectedProfit.toFixed(2)} expected on campaign`
          : `~£${remainingEv.toFixed(0)} est. from £${rules.freeBetAmount} place-refund FB`,
      basis: offer.expectedProfit != null ? "estimated" : "heuristic",
    };
  }

  if (offer.expectedProfit != null && Math.abs(offer.expectedProfit) > 0.01) {
    const remaining = offer.expectedProfit - profit.totalProfit;
    if (remaining > 0.01) {
      return {
        remainingEv: remaining,
        reason: `£${remaining.toFixed(2)} of £${offer.expectedProfit.toFixed(2)} expected still open`,
        basis: "estimated",
      };
    }
  }

  const openExpected = offer.expectedFromBets;
  if (profit.qualifyingOpenCount > 0 || profit.freeBetOpenCount > 0) {
    return {
      remainingEv: Math.max(openExpected, 0),
      reason:
        openExpected > 0.01
          ? `£${openExpected.toFixed(2)} expected on open legs`
          : "Open legs - EV not set",
      basis: "estimated",
    };
  }

  if (offer.status === "planned" || offer.betCount === 0) {
    const planned = offer.expectedProfit ?? 0;
    return {
      remainingEv: Math.max(planned, 0),
      reason:
        planned > 0
          ? `£${planned.toFixed(2)} expected if started`
          : "Planned - set expected profit to rank this",
      basis: planned > 0 ? "estimated" : "heuristic",
    };
  }

  return { remainingEv: 0, reason: "No remaining EV estimate", basis: "heuristic" };
}

export function scoreOfferAdvantage(
  offer: OfferSummary,
  now = Date.now(),
  opts?: AdvantageOpts
): OfferAdvantageScore | null {
  if (offer.status === "completed" || offer.status === "expired") return null;

  const nextAction = deriveOfferNextAction(offer, now);
  // Waiting on a result is not a "Best next" candidate - user already did the work.
  if (nextAction?.kind === "await_result") return null;

  const { remainingEv, reason, basis } = estimateOfferRemainingEv(offer, opts);
  const urgency = urgencyFromExpiry(effectiveOfferExpiryMs(offer), now);

  // Stage multipliers - cash sitting as awarded FB is highest leverage
  let stageBoost = 1;
  if (offer.profit.freeBetStage === "awarded") stageBoost = 1.45;
  else if (nextAction?.kind === "place_qualifying" || nextAction?.kind === "start_planned") {
    stageBoost = 1.05;
  }

  const health =
    (offer.bookmaker
      ? opts?.bookmakerHealth?.get(offer.bookmaker.trim().toLowerCase())
      : undefined) ?? "healthy";

  const healthMultiplier = health === "gubbed" ? GUBBED_SCORE_MULTIPLIER : 1;
  const score = remainingEv * stageBoost * (1 + urgency * 0.5) * healthMultiplier;

  // Skip noise with no action and no EV
  if (score < 0.01 && nextAction == null) return null;

  return {
    offerId: offer.id,
    offerTitle: offer.title,
    bookmaker: offer.bookmaker,
    remainingEv,
    basis,
    urgency,
    score,
    reason,
    nextAction,
    health,
  };
}

export function rankOfferAdvantages(
  offers: OfferSummary[],
  now = Date.now(),
  opts?: AdvantageOpts
): OfferAdvantageScore[] {
  return offers
    .map((o) => scoreOfferAdvantage(o, now, opts))
    .filter((s): s is OfferAdvantageScore => s != null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.offerTitle.localeCompare(b.offerTitle);
    });
}

export function bestOfferAdvantage(
  offers: OfferSummary[],
  now = Date.now(),
  opts?: AdvantageOpts
): OfferAdvantageScore | null {
  return rankOfferAdvantages(offers, now, opts)[0] ?? null;
}
