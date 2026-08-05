/**
 * Required cash stake for an offer campaign.
 * Shared by Do next funding checks and the campaign balance box.
 *
 * Preference: rules.betStake → rules.minStake → "Bet £X" in title.
 */
export function offerRequiredStake(offer: {
  rules: string | null;
  title?: string | null;
}): number | null {
  if (offer.rules) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = JSON.parse(offer.rules);
      if (typeof parsed?.betStake === "number" && parsed.betStake > 0) {
        return parsed.betStake;
      }
      if (typeof parsed?.minStake === "number" && parsed.minStake > 0) {
        return parsed.minStake;
      }
      const importantMin = parsed?.important?.minStake;
      if (typeof importantMin === "number" && importantMin > 0) {
        return importantMin;
      }
    } catch {
      // fall through to title
    }
  }
  return stakeFromOfferTitle(offer.title);
}

/** Parse "Bet £10 …" style titles when rules omit betStake. */
export function stakeFromOfferTitle(title: string | null | undefined): number | null {
  if (!title?.trim()) return null;
  const m = title.match(/\bbet\s*£\s*(\d+(?:\.\d{1,2})?)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) && n > 0 ? n : null;
}
