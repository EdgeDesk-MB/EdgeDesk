/**
 * UK each-way place terms by field size and race type.
 * Source conventions: Matched Betting Blog / industry standard tables.
 *
 * | Runners | Type        | Places | Fraction |
 * | 1–4     | any         | 1      | —        |
 * | 5–7     | any         | 2      | 1/4      |
 * | 8–11    | any         | 3      | 1/5      |
 * | 12–15   | non-hcap    | 3      | 1/5      |
 * | 12–15   | handicap    | 3      | 1/4      |
 * | 16+     | non-hcap    | 3      | 1/5      |
 * | 16+     | handicap    | 4      | 1/4      |
 */

export type UkPlaceTerms = {
  /** Places paid (1 = win only). */
  places: number;
  /** Fraction of (winOdds − 1); null when win-only. */
  placeFraction: number | null;
  isHandicap: boolean;
};

export function inferIsHandicap(input: {
  type?: string | null;
  raceName?: string | null;
}): boolean {
  const blob = `${input.type ?? ""} ${input.raceName ?? ""}`.toLowerCase();
  return /\bhandicap\b|\bh'?caps?\b|\bhcp\b/.test(blob);
}

export function ukPlaceTerms(
  fieldSize: number,
  opts?: { isHandicap?: boolean; type?: string | null; raceName?: string | null }
): UkPlaceTerms {
  const n = Number.isFinite(fieldSize) ? Math.max(0, Math.floor(fieldSize)) : 0;
  const isHandicap =
    opts?.isHandicap ??
    inferIsHandicap({ type: opts?.type, raceName: opts?.raceName });

  if (n <= 4) {
    return { places: 1, placeFraction: null, isHandicap };
  }
  if (n <= 7) {
    return { places: 2, placeFraction: 0.25, isHandicap };
  }
  if (isHandicap && n >= 16) {
    return { places: 4, placeFraction: 0.25, isHandicap };
  }
  if (isHandicap && n >= 12) {
    return { places: 3, placeFraction: 0.25, isHandicap };
  }
  // 8+ non-handicap (and 8–11 handicap): 3 places at 1/5
  return { places: 3, placeFraction: 0.2, isHandicap };
}

/** Places only — drop-in for legacy `placePositions(fieldSize)`. */
export function placePositionsFromTerms(
  fieldSize: number,
  opts?: { isHandicap?: boolean; type?: string | null; raceName?: string | null }
): number {
  return ukPlaceTerms(fieldSize, opts).places;
}
