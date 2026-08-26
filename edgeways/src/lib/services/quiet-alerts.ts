/**
 * Pull down offer_expiring prompts when a campaign is done, expired, or
 * deleted: mark matching inbox rows read and ask every push device to close
 * the shade notification by tag.
 */
import "server-only";
import {
  freeBetExpiringAlertDedupePrefix,
  freeBetExpiringAlertKeys,
  offerExpiringAlertDedupePrefix,
  offerExpiringAlertKeys,
} from "@/lib/alerts/expiring-alert-keys";
import {
  markReadByDedupeAsync,
  markReadByDedupePrefixAsync,
} from "@/lib/services/alerts-inbox";
import { dismissPush } from "@/lib/services/push";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tags AlertWatcher may have used for this offer today or yesterday. */
export function offerExpiringDismissTags(offerId: number, now = Date.now()): string[] {
  return [
    ...new Set([
      ...offerExpiringAlertKeys(offerId, now),
      ...offerExpiringAlertKeys(offerId, now - DAY_MS),
    ]),
  ];
}

export function quietOfferAlerts(offerId: number, now = Date.now()): void {
  if (!Number.isFinite(offerId) || offerId <= 0) return;
  // Async dispatchers (EDGE-110): hosted desks mark the Neon inbox; local runs
  // the sync SQLite path inside. Fire-and-forget either way.
  void markReadByDedupePrefixAsync(offerExpiringAlertDedupePrefix(offerId), now).catch(
    () => {}
  );
  void dismissPush(offerExpiringDismissTags(offerId, now)).catch(() => {});
}

/** Tags AlertWatcher may have used for this free-bet lot today or yesterday. */
export function freeBetExpiringDismissTags(lotId: number, now = Date.now()): string[] {
  return [
    ...new Set([
      ...freeBetExpiringAlertKeys(lotId, now),
      ...freeBetExpiringAlertKeys(lotId, now - DAY_MS),
    ]),
  ];
}

export function quietFreeBetAlerts(lotId: number, now = Date.now()): void {
  if (!Number.isFinite(lotId) || lotId <= 0) return;
  void markReadByDedupePrefixAsync(freeBetExpiringAlertDedupePrefix(lotId), now).catch(
    () => {}
  );
  void dismissPush(freeBetExpiringDismissTags(lotId, now)).catch(() => {});
}

/** Mark inbox rows read (by exact dedupe) and dismiss matching push tags. */
export function quietAlertTags(tags: string[], now = Date.now()): void {
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (clean.length === 0) return;
  for (const tag of clean) void markReadByDedupeAsync(tag, now).catch(() => {});
  void dismissPush(clean).catch(() => {});
}
