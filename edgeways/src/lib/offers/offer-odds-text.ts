/**
 * Offer copy should use decimal odds — matched betting math is decimal-first.
 * Converts fractional odds in free text and formats place positions without "/" ambiguity.
 */
import { fractionalToDecimal } from "@/lib/calc/odds";
import { formatDecimalOdds } from "@/lib/racing/odds";

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** e.g. [4, 6] → "4th or 6th", [2, 3, 4] → "2nd, 3rd or 4th" */
export function formatQualifyingPlacesPhrase(places: number[]): string {
  if (places.length === 0) return "place refund";
  const labels = places.map(ordinal);
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

function formatFractionAsDecimal(num: number, den: number): string | null {
  const dec = fractionalToDecimal(`${num}/${den}`);
  if (dec == null || dec < 1) return null;
  return formatDecimalOdds(dec);
}

function isOddsContext(before: string, after: string): boolean {
  const ctx = `${before}${after}`.toLowerCase();
  if (/\b\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}\b/.test(ctx)) return false;
  return (
    /\b(?:min(?:imum)?\s+)?(?:odds|price)\b/.test(ctx) ||
    /\bodds\s+of\b/.test(ctx) ||
    /\bat\s+(?:least\s+)?(?:odds|price)\b/.test(ctx) ||
    /\b(?:decimal|fractional)\b/.test(ctx) ||
    /\bor\s+greater\b/.test(after) ||
    /\+\s*$/.test(after.trim()) ||
    /^\s*odds\b/i.test(after) ||
    /\bev(?:ens|en\s+money)\b/i.test(ctx)
  );
}

function isPlacePositionContext(before: string, after: string, num: number, den: number): boolean {
  if (/refund\s+if\s*$/i.test(before)) return true;
  if (/finishes?\s+(?:in\s+)?$/i.test(before)) return true;
  if (/if\s+places?\s*$/i.test(before)) return true;
  if (/\bplaces?\s*$/i.test(before)) return true;
  if (/\b(?:2nd|3rd|4th|5th|6th|7th|8th)\b/i.test(before + after)) return true;
  // Two small integers typical of finishing positions, not price (e.g. 4/6 refund places)
  if (
    num >= 2 &&
    num <= 8 &&
    den >= 2 &&
    den <= 8 &&
    num !== den &&
    /refund|place|finishes?/i.test(before + after)
  ) {
    return true;
  }
  return false;
}

function replaceRefundPlaceSlashes(text: string): string {
  return text.replace(
    /refund\s+if\s+((?:\d+\s*\/\s*)+\d+)/gi,
    (_, group: string) => {
      const places = group
        .split("/")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 2 && n <= 20);
      if (places.length < 2) return `refund if ${group}`;
      return `refund if ${formatQualifyingPlacesPhrase(places)}`;
    }
  );
}

/**
 * Rewrite fractional odds in offer details to decimal (e.g. 1/2 → 1.50, 4/6 odds → 1.67).
 * Place-position slashes (refund if 4/6) become ordinals instead.
 */
export function convertFractionalOddsInText(text: string): string {
  if (!text.trim()) return text;

  let out = replaceRefundPlaceSlashes(text);

  // "1/2 (1.50)" or "1/2 (1.5)" → decimal only
  out = out.replace(
    /\b(\d+)\s*\/\s*(\d+)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)/g,
    (_m, _a, _b, decimal: string) => formatDecimalOdds(parseFloat(decimal))
  );

  // "1/5 odds" → "1.20 odds"
  out = out.replace(/\b(\d+)\s*\/\s*(\d+)\s+odds\b/gi, (match, a: string, b: string) => {
    const formatted = formatFractionAsDecimal(parseInt(a, 10), parseInt(b, 10));
    return formatted != null ? `${formatted} odds` : match;
  });

  out = out.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (match, a: string, b: string, offset: number) => {
    const num = parseInt(a, 10);
    const den = parseInt(b, 10);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return match;

    const before = out.slice(Math.max(0, offset - 48), offset);
    const after = out.slice(offset + match.length, offset + match.length + 24);

    if (isPlacePositionContext(before, after, num, den)) return match;
    if (after.startsWith("/")) return match;
    if (num <= 31 && den <= 12 && /\b(?:expires?|valid|until|on|at)\s*$/i.test(before)) return match;
    if (num > 20 || den > 20) return match;

    if (!isOddsContext(before, after)) return match;

    const formatted = formatFractionAsDecimal(num, den);
    return formatted ?? match;
  });

  return out;
}

/** Normalize offer description / important-notes for display and storage. */
export function normalizeOfferDetailsText(text: string | null | undefined): string {
  if (!text?.trim()) return text?.trim() ?? "";
  return convertFractionalOddsInText(text.replace(/\s+/g, " ").trim());
}
