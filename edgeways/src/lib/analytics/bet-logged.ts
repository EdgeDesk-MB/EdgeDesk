export const BET_LOGGED_SOURCES = [
  "manual",
  "slip_import",
  "bet_builder",
] as const;
export type BetLoggedSource = (typeof BET_LOGGED_SOURCES)[number];

/**
 * Loop signal properties for a new bet. Only how it was logged and whether
 * it is the user's first. Never the label, selection, stake, odds,
 * bookmaker, notes or any other bet field.
 */
export function betLoggedProperties(input: {
  source: BetLoggedSource;
  isFirst: boolean;
}) {
  return {
    source: input.source,
    is_first: input.isFirst,
  };
}
