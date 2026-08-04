/**
 * Important / must-not-forget offer terms.
 * Stored inside offers.rules JSON (alongside racing rules when present).
 */

import type { OfferRow } from "@/lib/db/schema";
import { formatClockTime } from "@/lib/time-format";
import type { BetGetFreePlaceRules } from "@/lib/offers/racing-offer-rules";

export interface PromoTermsRules {
  type: "promo_terms";
  /** Minimum decimal odds for qualifying / free bet */
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  /** Free-text must-not-forget (min selections, SNR, etc.) */
  importantNotes?: string | null;
}

export type OfferRulesJson = BetGetFreePlaceRules | PromoTermsRules;

export interface OfferImportantTerms {
  minOdds: number | null;
  minStake: number | null;
  maxStake: number | null;
  importantNotes: string;
}

export function emptyImportantTerms(): OfferImportantTerms {
  return { minOdds: null, minStake: null, maxStake: null, importantNotes: "" };
}

export function parsePromoTerms(offer: Pick<OfferRow, "rules" | "offerType">): PromoTermsRules | null {
  if (!offer.rules) return null;
  try {
    const parsed = JSON.parse(offer.rules) as OfferRulesJson;
    if (parsed.type === "promo_terms") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Read important terms from any rules payload (racing or promo_terms). */
export function readImportantTerms(
  offer: Pick<OfferRow, "rules" | "offerType">
): OfferImportantTerms {
  const empty = emptyImportantTerms();
  if (!offer.rules) return empty;
  try {
    const parsed = JSON.parse(offer.rules) as OfferRulesJson & {
      minOdds?: number | null;
      minStake?: number | null;
      maxStake?: number | null;
      importantNotes?: string | null;
    };
    return {
      minOdds: typeof parsed.minOdds === "number" ? parsed.minOdds : null,
      minStake: typeof parsed.minStake === "number" ? parsed.minStake : null,
      maxStake: typeof parsed.maxStake === "number" ? parsed.maxStake : null,
      importantNotes: typeof parsed.importantNotes === "string" ? parsed.importantNotes : "",
    };
  } catch {
    return empty;
  }
}

export function mergeImportantIntoRacingRules(
  rules: BetGetFreePlaceRules,
  important: OfferImportantTerms
): BetGetFreePlaceRules & {
  minOdds?: number | null;
  minStake?: number | null;
  maxStake?: number | null;
  importantNotes?: string | null;
} {
  return {
    ...rules,
    minOdds: important.minOdds,
    minStake: important.minStake,
    maxStake: important.maxStake,
    importantNotes: important.importantNotes.trim() || null,
  };
}

export function buildPromoTermsRules(important: OfferImportantTerms): PromoTermsRules | null {
  const notes = important.importantNotes.trim();
  if (
    important.minOdds == null &&
    important.minStake == null &&
    important.maxStake == null &&
    !notes
  ) {
    return null;
  }
  return {
    type: "promo_terms",
    minOdds: important.minOdds,
    minStake: important.minStake,
    maxStake: important.maxStake,
    importantNotes: notes || null,
  };
}

export function formatImportantTermsSummary(terms: OfferImportantTerms): string | null {
  const parts: string[] = [];
  if (terms.minOdds != null) parts.push(`Min odds ${formatOdds(terms.minOdds)}`);
  if (terms.minStake != null) parts.push(`Min stake £${terms.minStake}`);
  if (terms.maxStake != null) parts.push(`Max stake £${terms.maxStake}`);
  if (terms.importantNotes.trim()) parts.push(terms.importantNotes.trim());
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatOdds(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Local datetime-local input value from epoch ms. */
export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local string as local time → epoch ms. */
export function fromDatetimeLocalValue(value: string): number | null {
  if (!value.trim()) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function formatOfferExpiry(ms: number | null | undefined): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}, ${formatClockTime(d)}`;
}
