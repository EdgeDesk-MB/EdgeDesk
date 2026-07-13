import type { OfferSummary } from "@/lib/services/offers.types";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";

export type OfferNextActionKind =
  | "place_qualifying"
  | "await_result"
  | "convert_free_bet"
  | "review_expiry"
  | "start_planned";

export interface OfferNextAction {
  offerId: number;
  kind: OfferNextActionKind;
  priority: number;
  title: string;
  detail: string;
  href: string;
  bookmaker: string | null;
  offerTitle: string;
  expiresAt: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(expiresAt: number | null, now: number): number | null {
  if (expiresAt == null) return null;
  return (expiresAt - now) / DAY_MS;
}

/** True when the user can act now (not waiting on a result). */
export function isActionableOfferNext(kind: OfferNextActionKind): boolean {
  return kind !== "await_result";
}

/**
 * Derive the single most useful next step for an offer campaign.
 * Priority is lower = more urgent (sorted ascending).
 */
export function deriveOfferNextAction(
  offer: OfferSummary,
  now = Date.now()
): OfferNextAction | null {
  if (offer.status === "completed" || offer.status === "expired") return null;

  const profit = offer.profit;
  const bookmaker = offer.bookmaker;
  const offerTitle = offer.title;
  const expiresAt = effectiveOfferExpiryMs(offer);
  const days = daysUntil(expiresAt, now);
  const expiringSoon = days != null && days >= 0 && days <= 3;

  const base = {
    offerId: offer.id,
    bookmaker,
    offerTitle,
    expiresAt,
    href: `/offers?highlight=${offer.id}`,
  };

  if (offer.status === "planned" && offer.betCount === 0) {
    return {
      ...base,
      kind: "start_planned",
      priority: expiringSoon ? 15 : 40,
      title: "Start this offer",
      detail: expiringSoon
        ? `Expires soon - place the qualifying bet${bookmaker ? ` at ${bookmaker}` : ""}.`
        : `Log the qualifying bet to move this from planned to active.`,
    };
  }

  if (profit.qualifyingOpenCount > 0 && profit.freeBetStage === "awaiting_result") {
    return {
      ...base,
      kind: "await_result",
      priority: 50,
      title: "Awaiting result",
      detail: "Qualifying bet is open - free bet awards when the result lands.",
    };
  }

  if (profit.qualifyingOpenCount > 0 && profit.freeBetStage === "none") {
    return {
      ...base,
      kind: "await_result",
      priority: 55,
      title: "Qualifying in play",
      detail: `${profit.qualifyingOpenCount} open qualifying bet${profit.qualifyingOpenCount === 1 ? "" : "s"} - settle when the event finishes.`,
    };
  }

  if (profit.freeBetStage === "awarded") {
    return {
      ...base,
      kind: "convert_free_bet",
      priority: expiringSoon ? 5 : 10,
      title: "Convert free bet",
      detail:
        profit.freeBetAwardAmount != null
          ? `£${profit.freeBetAwardAmount.toFixed(2)} free bet ready - place SNR/SR conversion.`
          : "Free bet awarded - place the conversion bet.",
      href: `/tracker?offer=${offer.id}&queue=offers&action=convert`,
    };
  }

  // Conversion already logged - nothing to do until the race settles.
  if (profit.freeBetStage === "in_use") {
    return {
      ...base,
      kind: "await_result",
      priority: 52,
      title: "Conversion in play",
      detail:
        profit.freeBetOpenCount === 1
          ? "Free-bet conversion is open - P&L finalises when the result lands."
          : `${profit.freeBetOpenCount} free-bet legs open - P&L finalises when results land.`,
      href: `/tracker?offer=${offer.id}&queue=offers`,
    };
  }

  if (
    (offer.status === "active" || offer.status === "planned") &&
    profit.qualifyingSettledCount === 0 &&
    profit.qualifyingOpenCount === 0 &&
    profit.freeBetStage === "none"
  ) {
    return {
      ...base,
      kind: "place_qualifying",
      priority: expiringSoon ? 8 : 30,
      title: "Place qualifying bet",
      detail: bookmaker
        ? `No bets linked yet - start the qualifying leg at ${bookmaker}.`
        : "No bets linked yet - start the qualifying leg.",
      href: `/tracker?offer=${offer.id}&queue=offers&action=qualify`,
    };
  }

  if (expiringSoon && offer.status === "active") {
    return {
      ...base,
      kind: "review_expiry",
      priority: 12,
      title: "Review before expiry",
      detail:
        days != null && days < 1
          ? "Expires today - check open legs and free-bet balance."
          : `Expires in ${Math.ceil(days ?? 0)} day${Math.ceil(days ?? 0) === 1 ? "" : "s"}.`,
    };
  }

  return null;
}

function isEarlierSeriesInstance(a: OfferSummary, b: OfferSummary): boolean {
  const ad = a.instanceDate ?? "";
  const bd = b.instanceDate ?? "";
  if (ad !== bd) return ad < bd;
  return a.id < b.id;
}

/**
 * Collapse recurring-series instances to the next one due: repeats beyond the
 * earliest live instance are never today's work, so they stay out of the queue.
 */
function nextInstancePerSeries(offers: OfferSummary[]): OfferSummary[] {
  const nextBySeries = new Map<number, OfferSummary>();
  for (const offer of offers) {
    if (offer.seriesId == null) continue;
    if (offer.status === "completed" || offer.status === "expired") continue;
    const current = nextBySeries.get(offer.seriesId);
    if (!current || isEarlierSeriesInstance(offer, current)) {
      nextBySeries.set(offer.seriesId, offer);
    }
  }
  return offers.filter((o) => o.seriesId == null || nextBySeries.get(o.seriesId) === o);
}

/**
 * Actionable next steps only (excludes waiting-on-result).
 * Use for Best Next, Next actions, and nav badges.
 * Recurring campaigns contribute at most one action: their next instance due.
 */
export function listOfferNextActions(
  offers: OfferSummary[],
  now = Date.now()
): OfferNextAction[] {
  return nextInstancePerSeries(offers)
    .map((o) => deriveOfferNextAction(o, now))
    .filter((a): a is OfferNextAction => a != null && isActionableOfferNext(a.kind))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const ae = a.expiresAt ?? Number.POSITIVE_INFINITY;
      const be = b.expiresAt ?? Number.POSITIVE_INFINITY;
      if (ae !== be) return ae - be;
      return a.offerTitle.localeCompare(b.offerTitle);
    });
}

export function offerNextActionLabel(kind: OfferNextActionKind): string {
  switch (kind) {
    case "place_qualifying":
      return "Qualify";
    case "await_result":
      return "Waiting";
    case "convert_free_bet":
      return "Convert";
    case "review_expiry":
      return "Expiring";
    case "start_planned":
      return "Start";
    default:
      return kind;
  }
}
