import { isWorldCupCompetition } from "@/lib/accounts/access";
import { countryLabelToIso } from "@/lib/geo/region";

/** Known domestic leagues → flag code when API country is missing (demo / sparse feeds). */
const COMPETITION_TO_ISO: Record<string, string> = {
  "premier league": "ENG",
  championship: "ENG",
  "league one": "ENG",
  "league two": "ENG",
  "fa cup": "ENG",
  "la liga": "ES",
  "serie a": "IT",
  bundesliga: "DE",
  "ligue 1": "FR",
  eredivisie: "NL",
  "primeira liga": "PT",
  "pro league": "BE",
  "super lig": "TR",
  "mls": "US",
  "major league soccer": "US",
};

export function isGlobalFootballCompetition(competition: string): boolean {
  return isWorldCupCompetition(competition);
}

/** Flag code for a competition header; null when global (World Cup) or unknown. */
export function competitionFlagIso(
  competition: string,
  leagueCountry?: string | null
): string | null {
  if (isWorldCupCompetition(competition)) return null;
  const fromCountry = countryLabelToIso(leagueCountry);
  if (fromCountry) return fromCountry;
  return COMPETITION_TO_ISO[competition.trim().toLowerCase()] ?? null;
}
