import type { OfferSummary } from "@/lib/services/offers.types";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { isOfferEffectivelyExpired } from "@/lib/offers/offer-list-groups";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { formatAwaitingResultLabel } from "@/lib/offers/pipeline";
import {
  currentPlaybookStep,
  readPlaybookFromRulesJson,
  syncPlaybookFromOfferProfit,
  type OfferPlaybookStepKind,
} from "@/lib/offers/offer-playbook";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { formatClockTime } from "@/lib/time-format";

export type OfferNextActionKind =
  | "place_qualifying"
  | "await_result"
  | "convert_free_bet"
  | "review_expiry"
  | "start_planned"
  | "playbook_deposit"
  | "playbook_opt_in"
  | "playbook_clear_wagering"
  | "playbook_await_award";

/** The specific race and runner Offer Edge recommends for this action. */
export interface OfferNextActionEdge {
  raceExternalId: string;
  course: string;
  /** Epoch ms. The off time is rendered from this, never from the raw card string. */
  startTime: number;
  runnerName: string;
  backDecimal: number;
  totalEv: number;
}

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
  /** Nominal free-bet face value when kind is convert_free_bet */
  freeBetAmount?: number;
  /** Present when Offer Edge could name a race and horse for this offer. */
  edge?: OfferNextActionEdge;
}

export interface OfferNextActionOptions {
  /** Best Offer Edge play per offer id. */
  edgePlays?: Map<number, OfferEdgePlay>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toActionEdge(play: OfferEdgePlay): OfferNextActionEdge {
  return {
    raceExternalId: play.raceExternalId,
    course: play.course,
    startTime: play.startTime,
    runnerName: play.runner.name,
    backDecimal: play.runner.backDecimal,
    totalEv: play.totalEv,
  };
}

/** "Chepstow 15:20, back Storm Rider at 6.50, EV +£12.40." */
function formatEdgeDetail(edge: OfferNextActionEdge): string {
  const ev =
    edge.totalEv >= 0
      ? `+£${edge.totalEv.toFixed(2)}`
      : `-£${Math.abs(edge.totalEv).toFixed(2)}`;
  return `${edge.course} ${formatClockTime(edge.startTime)}, back ${edge.runnerName} at ${formatDecimalOdds(edge.backDecimal)}, EV ${ev}.`;
}

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
  now = Date.now(),
  opts?: OfferNextActionOptions
): OfferNextAction | null {
  if (offer.status === "completed") return null;
  // Past deadline (or status expired) - nothing left to do in Do next.
  if (isOfferEffectivelyExpired(offer, now)) return null;

  const edgePlay = opts?.edgePlays?.get(offer.id);
  const edge = edgePlay ? toActionEdge(edgePlay) : undefined;

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

  // O1 playbook soft gates (deposit / opt-in / WR) — including planned campaigns
  {
    const rawPb = readPlaybookFromRulesJson(offer.rules);
    if (rawPb) {
      const synced = syncPlaybookFromOfferProfit(rawPb, profit, now);
      const step = currentPlaybookStep(synced);
      const softKind = (k: OfferPlaybookStepKind): OfferNextActionKind | null => {
        if (k === "deposit") return "playbook_deposit";
        if (k === "opt_in") return "playbook_opt_in";
        if (k === "clear_wagering") return "playbook_clear_wagering";
        if (k === "await_award") return "playbook_await_award";
        return null;
      };
      if (step) {
        const soft = softKind(step.kind);
        if (soft) {
          return {
            ...base,
            kind: soft,
            priority: expiringSoon ? 5 : 12,
            title: step.title,
            detail: step.detail,
          };
        }
      }
    }
  }

  if (offer.status === "planned" && offer.betCount === 0) {
    return {
      ...base,
      kind: "start_planned",
      priority: expiringSoon ? 15 : 40,
      title: "Start this offer",
      detail: edge
        ? formatEdgeDetail(edge)
        : expiringSoon
          ? `Expires soon - place the qualifying bet${bookmaker ? ` at ${bookmaker}` : ""}.`
          : `Log the qualifying bet to move this from planned to active.`,
      edge,
    };
  }

  if (profit.qualifyingOpenCount > 0 && profit.freeBetStage === "awaiting_result") {
    return {
      ...base,
      kind: "await_result",
      priority: 50,
      title: formatAwaitingResultLabel(offer),
      detail:
        "Qualifying bet is open - free bet awards on settlement, or mark Free bet awarded in the feed if the bookie released it early.",
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
    const freeBetAmount = profit.freeBetAwardAmount ?? undefined;
    return {
      ...base,
      kind: "convert_free_bet",
      priority: 1,
      title: "Convert free bet",
      detail:
        profit.freeBetAwardAmount != null
          ? `£${profit.freeBetAwardAmount.toFixed(2)} free bet ready.`
          : "Free bet ready - place the conversion bet.",
      href: `/tracker?offer=${offer.id}&queue=offers&action=convert`,
      freeBetAmount,
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
      detail: edge
        ? formatEdgeDetail(edge)
        : bookmaker
          ? `No bets linked yet - start the qualifying leg at ${bookmaker}.`
          : "No bets linked yet - start the qualifying leg.",
      href: `/tracker?offer=${offer.id}&queue=offers&action=qualify`,
      edge,
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

/**
 * Actionable next steps only (excludes waiting-on-result).
 * Use for Best Next, Next actions, and nav badges.
 */
export function listOfferNextActions(
  offers: OfferSummary[],
  now = Date.now(),
  opts?: OfferNextActionOptions
): OfferNextAction[] {
  return offers
    .map((o) => deriveOfferNextAction(o, now, opts))
    .filter((a): a is OfferNextAction => a != null && isActionableOfferNext(a.kind))
    .sort((a, b) => {
      if (a.kind === "convert_free_bet" && b.kind !== "convert_free_bet") return -1;
      if (b.kind === "convert_free_bet" && a.kind !== "convert_free_bet") return 1;
      if (a.kind === "convert_free_bet" && b.kind === "convert_free_bet") {
        const byFace = (b.freeBetAmount ?? 0) - (a.freeBetAmount ?? 0);
        if (byFace !== 0) return byFace;
      }
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
    case "playbook_deposit":
      return "Deposit";
    case "playbook_opt_in":
      return "Opt in";
    case "playbook_clear_wagering":
      return "Clear WR";
    case "playbook_await_award":
      return "Awaiting award";
    default:
      return kind;
  }
}
