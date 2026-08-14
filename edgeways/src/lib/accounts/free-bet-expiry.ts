/**
 * Compact free-bet expiry link copy: Set expiry / Expires X / Expired X.
 */
import { formatOfferExpiryCompact } from "@/lib/offers/offer-terms";

export function freeBetExpiryLinkLabel(
  expiresAt: number | null | undefined,
  now = Date.now()
): string {
  if (expiresAt == null) return "Set expiry";
  const when = formatOfferExpiryCompact(expiresAt);
  return expiresAt < now ? `Expired ${when}` : `Expires ${when}`;
}

/** Strip promo/lot-marker prefixes for display and alert bodies. */
export function freeBetLotNoteLabel(note: string | null | undefined): string {
  return (
    note
      ?.replace(/^Free bet promo - /, "")
      .replace(/^Free bet removed - /, "")
      .replace(/\[\[lot:\d+\]\]\s*/g, "")
      .trim() || "Free bet credit"
  );
}
