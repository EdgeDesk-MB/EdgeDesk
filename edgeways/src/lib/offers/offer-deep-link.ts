/**
 * Deep link into the campaign details modal on /offers (P1 push notifications).
 *
 * Deliberately not `view`: the public demo owns that param for its plan
 * preview, so an alert carrying `?view=<id>` turned a Free or Core preview
 * into Edge on reload (EDGE-159). Notifications already delivered still hold
 * the old shape, so reads accept the legacy param too.
 */

export const OFFER_DEEP_LINK_PARAM = "offer";
/** @deprecated Read-only, for notifications sent before EDGE-159. */
export const OFFER_DEEP_LINK_LEGACY_PARAM = "view";

export function offerDeepLinkHref(offerId: number): string {
  return `/offers?${OFFER_DEEP_LINK_PARAM}=${offerId}`;
}

/**
 * Digits only, so a demo plan id such as `free` is never read as an offer and
 * never stripped from the URL.
 */
export function parseOfferDeepLinkId(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!/^\d+$/.test(trimmed)) return null;
  const id = Number(trimmed);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
