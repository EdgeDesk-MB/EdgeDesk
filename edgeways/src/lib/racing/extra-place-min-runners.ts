/**
 * Minimum runners for bookie extra-place offers to stand.
 * Seeded from Outplayed-style public tables (verify per race T&Cs).
 *
 * Terminology: "16+ runners" means at 15 runners the bookie drops from 5→4 places.
 */

export type ExtraPlaceBand = 3 | 4 | 5;

function normBookie(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Default mins when bookie unknown. */
const DEFAULT_MIN: Record<ExtraPlaceBand, number> = {
  5: 16,
  4: 12,
  3: 7,
};

/** Bookie-specific overrides (lower = more generous). */
const BOOKIE_MIN: Record<string, Partial<Record<ExtraPlaceBand, number>>> = {
  bet365: { 5: 15, 4: 11, 3: 6 },
  midnite: { 5: 14, 4: 11 },
  betuk: { 5: 20 },
  casumo: { 5: 20 },
  grosvenor: { 5: 20 },
  leovegas: { 5: 20 },
  betfairsportsbook: { 5: 16, 4: 11, 3: 6 },
  paddypower: { 5: 16, 4: 11, 3: 6 },
  williamhill: { 3: 6 },
  skybet: { 4: 8, 3: 6 },
  unibet: { 4: 8, 3: 7 },
  "32red": { 4: 8, 3: 7 },
  daznbet: { 4: 8 },
  coral: { 4: 11, 3: 7 },
  ladbrokes: { 4: 11, 3: 7 },
  betfred: { 3: 7 },
  betvictor: { 4: 11 },
  akbets: { 4: 11 },
  copybet: { 4: 10 },
  hollywoodbets: { 4: 10 },
  netbet: { 4: 10 },
  vbet: { 4: 10 },
};

/**
 * Minimum field size for an advertised bookie place count to remain an "extra"
 * vs the exchange standard. Returns null for win-only / unknown bands.
 */
export function minRunnersForExtraPlace(
  bookiePlaces: number,
  bookmaker?: string | null
): number | null {
  if (bookiePlaces < 3 || bookiePlaces > 5) {
    // 6+ places are race-specific — caller should check T&Cs
    if (bookiePlaces >= 6) return null;
    return null;
  }
  const band = bookiePlaces as ExtraPlaceBand;
  const key = normBookie(bookmaker);
  const override = key ? BOOKIE_MIN[key]?.[band] : undefined;
  return override ?? DEFAULT_MIN[band];
}

/** True when field is at or within `buffer` of the drop threshold. */
export function nearExtraPlaceMinRunners(
  fieldSize: number,
  bookiePlaces: number,
  bookmaker?: string | null,
  buffer = 2
): boolean {
  const min = minRunnersForExtraPlace(bookiePlaces, bookmaker);
  if (min == null || !(fieldSize > 0)) return false;
  return fieldSize <= min + buffer;
}

export function extraPlaceMinRunnersWarning(
  fieldSize: number,
  bookiePlaces: number,
  bookmaker?: string | null
): string | null {
  const min = minRunnersForExtraPlace(bookiePlaces, bookmaker);
  if (min == null || !(fieldSize > 0)) return null;
  if (fieldSize < min) {
    return `Only ${fieldSize} runners — need ${min}+ for ${bookiePlaces} places to stand (check T&Cs).`;
  }
  if (fieldSize <= min + 2) {
    return `${fieldSize} runners — close to the ${min}+ minimum for ${bookiePlaces} places. Non-runners can drop the offer.`;
  }
  return null;
}
