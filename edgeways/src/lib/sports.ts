/**
 * Bookmaker-style sport list - prominent UK staples first, then major international sports.
 * Used for bet entry, event labels, and icons across the app.
 */
export const SPORTS = [
  { value: "football", label: "Football" },
  { value: "horse_racing", label: "Horse racing" },
  { value: "tennis", label: "Tennis" },
  { value: "cricket", label: "Cricket" },
  { value: "rugby_union", label: "Rugby union" },
  { value: "rugby_league", label: "Rugby league" },
  { value: "golf", label: "Golf" },
  { value: "darts", label: "Darts" },
  { value: "basketball", label: "Basketball" },
  { value: "american_football", label: "American football" },
  { value: "boxing", label: "Boxing" },
  { value: "mma", label: "MMA / UFC" },
  { value: "snooker", label: "Snooker" },
  { value: "greyhounds", label: "Greyhounds" },
  { value: "motorsport", label: "Motorsport" },
  { value: "cycling", label: "Cycling" },
  { value: "ice_hockey", label: "Ice hockey" },
  { value: "volleyball", label: "Volleyball" },
  { value: "baseball", label: "Baseball" },
  { value: "esports", label: "Esports" },
  { value: "other", label: "Other" },
] as const;

export type SportValue = (typeof SPORTS)[number]["value"];

const LABEL_BY_VALUE = Object.fromEntries(SPORTS.map((s) => [s.value, s.label])) as Record<
  SportValue,
  string
>;

const SPORT_VALUE_SET = new Set<string>(SPORTS.map((s) => s.value));

export function isKnownSport(sport?: string | null): sport is SportValue {
  return !!sport && SPORT_VALUE_SET.has(sport);
}

/** Human label for a stored sport id; falls back to title-cased unknown values. */
export function sportDisplayLabel(sport?: string | null): string {
  const id = sport?.trim();
  if (!id) return LABEL_BY_VALUE.football;
  if (isKnownSport(id)) return LABEL_BY_VALUE[id];
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Racing-style sports (win/place markets, missed-race wording). */
export function isRacingSport(sport?: string | null): boolean {
  return sport === "horse_racing" || sport === "greyhounds";
}
