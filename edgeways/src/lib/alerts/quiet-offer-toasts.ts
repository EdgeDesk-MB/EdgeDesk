"use client";

/**
 * Pull down sticky offer_expiring toasts when the user completes a prompted
 * step in-tab (bet logged, mark complete, delete). OS shade + seen suppress
 * stay in sync; AlertWatcher remains a backup on the next poll.
 */

import {
  createLocalAlertChannel,
  dismissStickyAlertToasts,
} from "@/lib/alerts/local-channel";
import { offerExpiringAlertKeys } from "@/lib/alerts/expiring-alert-keys";
import {
  dismissAlertNotifications,
  suppressAlertKeys,
} from "@/lib/alerts/seen";
import type { OfferNextActionKind } from "@/lib/offers/next-actions";
import type { EdgeAlert } from "@/lib/alerts/types";

export function completedKindFromBetType(
  betType: string | null | undefined
): OfferNextActionKind | undefined {
  switch (betType) {
    case "free_snr":
    case "free_sr":
      return "convert_free_bet";
    case "qualifying":
    case "risk_free":
    case "back_only":
    case "boost":
      return "place_qualifying";
    default:
      return "place_qualifying";
  }
}

function suppressKeysForOffer(
  offerId: number,
  keys: string[],
  opts?: { completedKind?: OfferNextActionKind; suppressAll?: boolean }
): string[] {
  if (opts?.suppressAll || opts?.completedKind == null) return keys;
  const kinds = new Set<string>([opts.completedKind]);
  if (opts.completedKind === "place_qualifying" || opts.completedKind === "start_planned") {
    kinds.add("place_qualifying");
    kinds.add("start_planned");
    kinds.add("playbook_deposit");
    kinds.add("playbook_opt_in");
    kinds.add("playbook_await_award");
  }
  return keys.filter((key) =>
    [...kinds].some((kind) => key.includes(`offer-${offerId}-${kind}:`))
  );
}

/**
 * Dismiss today's sticky offer_expiring toasts + OS notifications for an offer.
 * Suppress seen keys for the completed step only (unless suppressAll).
 */
export function quietOfferPromptToasts(
  offerId: number,
  opts?: { completedKind?: OfferNextActionKind; suppressAll?: boolean }
): void {
  if (!Number.isFinite(offerId) || offerId <= 0) return;
  const keys = offerExpiringAlertKeys(offerId);
  if (keys.length === 0) return;

  dismissStickyAlertToasts(keys);
  void dismissAlertNotifications(keys);
  suppressAlertKeys(suppressKeysForOffer(offerId, keys, opts));
}

function stepDoneTitle(betType: string | null | undefined): string {
  switch (betType) {
    case "free_snr":
    case "free_sr":
      return "Free bet logged";
    case "qualifying":
    case "risk_free":
    case "back_only":
      return "Qualifying bet logged";
    default:
      return "Bet logged";
  }
}

/** Ephemeral EdgeAlert confirmation after an offer-linked bet save. Not inboxed. */
export function notifyOfferStepDone(args: {
  offerId: number;
  betId: number;
  betType?: string | null;
  bookmaker?: string | null;
  offerTitle?: string | null;
}): void {
  if (!Number.isFinite(args.offerId) || args.offerId <= 0) return;
  if (!Number.isFinite(args.betId) || args.betId <= 0) return;

  const body =
    args.offerTitle?.trim() || "It's in the Profit Tracker.";
  const alert: EdgeAlert = {
    key: `offer_step_done:${args.offerId}:${args.betId}`,
    kind: "offer_expiring",
    title: stepDoneTitle(args.betType),
    body,
    bookmaker: args.bookmaker?.trim() || null,
    tone: "positive",
    href: `/offers?view=${args.offerId}`,
    delivery: "ephemeral",
  };
  createLocalAlertChannel().notify(alert);
}
