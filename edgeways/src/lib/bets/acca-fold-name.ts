/**
 * UK bookmaker fold names for multi-selection tickets (Acca Desk + Bet Builder).
 *
 * Strict trade usage: Double (2), Treble (3); from four selections the size is
 * N-fold (four-fold, five-fold, …). Everyday "acca" covers doubles/trebles too;
 * Betfair-style bet builders use the same labels for 2+ selections.
 *
 * Hyphenated "four-fold" matches Racing Post / shop-slip style (not "fourfold").
 */

const SPELLED_FOLD: Record<number, string> = {
  4: "Four-fold",
  5: "Five-fold",
  6: "Six-fold",
  7: "Seven-fold",
  8: "Eight-fold",
  9: "Nine-fold",
  10: "Ten-fold",
  11: "Eleven-fold",
  12: "Twelve-fold",
};

/** Label for a straight accumulator of `selectionCount` legs, or null if &lt; 2. */
export function accaFoldName(selectionCount: number): string | null {
  if (!(selectionCount >= 2) || !Number.isFinite(selectionCount)) return null;
  const n = Math.floor(selectionCount);
  if (n === 2) return "Double";
  if (n === 3) return "Treble";
  return SPELLED_FOLD[n] ?? `${n}-fold`;
}

/**
 * Fold size for display: void legs drop out of the multiple (same as combined
 * odds), so a voided treble reads as a Double.
 */
export function accaFoldNameFromResults(
  legs: Array<{ result: "pending" | "won" | "lost" | "void" }>
): string | null {
  const live = legs.filter((l) => l.result !== "void").length;
  return accaFoldName(live > 0 ? live : legs.length);
}
