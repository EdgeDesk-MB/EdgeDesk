/**
 * Dedupe keys for offer_expiring and free_bet_expiring.
 *
 * Leaf module: no db, no server-only, no evaluateAlertRules. quiet-alerts
 * (server-only) and client toasts both import from here so adding a new
 * quiet* export cannot depend on a stale rules.ts graph.
 */
import type { OfferNextActionKind } from "@/lib/offers/next-actions";

/** Action kinds that can produce an offer_expiring alert. */
const OFFER_EXPIRING_ACTION_KINDS: OfferNextActionKind[] = [
  "place_qualifying",
  "convert_free_bet",
  "start_planned",
  "review_expiry",
];

export function alertDayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Dedupe keys AlertWatcher may have used for this offer today. */
export function offerExpiringAlertKeys(offerId: number, now = Date.now()): string[] {
  const day = alertDayKey(now);
  return OFFER_EXPIRING_ACTION_KINDS.map(
    (kind) => `offer_expiring:offer-${offerId}-${kind}:${day}`
  );
}

/** Inbox LIKE pattern covering every offer_expiring key for one offer. */
export function offerExpiringAlertDedupePrefix(offerId: number): string {
  return `offer_expiring:offer-${offerId}-`;
}

export function freeBetExpiringAlertKey(lotId: number, now = Date.now()): string {
  return `free_bet_expiring:lot-${lotId}:${alertDayKey(now)}`;
}

/** Dedupe keys AlertWatcher may have used for this free-bet lot today. */
export function freeBetExpiringAlertKeys(lotId: number, now = Date.now()): string[] {
  return [freeBetExpiringAlertKey(lotId, now)];
}

/** Inbox LIKE pattern covering every free_bet_expiring key for one lot. */
export function freeBetExpiringAlertDedupePrefix(lotId: number): string {
  return `free_bet_expiring:lot-${lotId}:`;
}
