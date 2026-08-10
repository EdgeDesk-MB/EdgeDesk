/**
 * Pure helpers for racing bet&get title place clauses.
 * Client-safe — no DB / server-only imports.
 */
import { parsePlacePositions } from "@/lib/calc/ai-triggers";

function placeOrdinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}

/** Places declared in a trailing "(2nd, 3rd, 4th)" / "(2nd–4th)" title clause. */
export function extractPlacesFromBetGetTitle(title: string): number[] {
  const paren = title.trim().match(/\(([^)]+)\)\s*$/);
  if (!paren) return [];
  const inner = paren[1]!.trim();
  if (/2nd\s+to\s+(?:the\s+)?(?:sp\s+|starting\s+price\s+)?fav/i.test(inner)) {
    return [2];
  }
  const range = inner.match(/\b(\d+)(?:st|nd|rd|th)?\s*[-–]\s*(\d+)(?:st|nd|rd|th)?\b/i);
  if (range) {
    const a = parseInt(range[1]!, 10);
    const b = parseInt(range[2]!, 10);
    if (a >= 1 && b <= 10 && Math.abs(b - a) <= 6) {
      const places: number[] = [];
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) places.push(i);
      return places;
    }
  }
  return parsePlacePositions(inner).filter((n) => n >= 2 && n <= 10);
}

export function samePlaces(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort((x, y) => x - y);
  const bs = [...b].sort((x, y) => x - y);
  return as.every((n, i) => n === bs[i]);
}

/** True when `subset` is non-empty and every place is in `full`, with fewer places. */
export function isProperPlaceSubset(subset: number[], full: number[]): boolean {
  if (subset.length === 0 || full.length === 0) return false;
  if (subset.length >= full.length) return false;
  const fullSet = new Set(full);
  return subset.every((n) => fullSet.has(n));
}

export function formatBetGetTitlePlaceClause(
  places: number[],
  opts?: { winnerMustBeSpFavourite?: boolean }
): string | null {
  const sorted = [...places]
    .filter((n) => Number.isInteger(n) && n >= 2 && n <= 10)
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return opts?.winnerMustBeSpFavourite ? "2nd to SP favourite" : null;
  }
  if (opts?.winnerMustBeSpFavourite) {
    return `${sorted.map(placeOrdinal).join(", ")} to SP favourite`;
  }
  if (sorted.length === 3 && sorted[0] === 2 && sorted[2] === 4) return "2nd–4th";
  if (sorted.length === 2 && sorted[0] === 2 && sorted[1] === 3) return "2nd & 3rd";
  return sorted.map(placeOrdinal).join(", ");
}

/**
 * Rewrite or strip the trailing place parenthetical so the title matches rules.
 * Used on editor save and when healing stale OCR titles after a user edit.
 */
export function syncBetGetTitleWithPlaces(
  title: string,
  places: number[],
  opts?: { winnerMustBeSpFavourite?: boolean }
): string {
  const clause = formatBetGetTitlePlaceClause(places, opts);
  const trimmed = title.trim();
  if (!trimmed) {
    return clause ? `(${clause})` : "";
  }
  if (/\([^)]*\)\s*$/.test(trimmed)) {
    if (clause) return trimmed.replace(/\([^)]*\)\s*$/, `(${clause})`).trim();
    return trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim();
  }
  if (clause) return `${trimmed} (${clause})`;
  return trimmed;
}
