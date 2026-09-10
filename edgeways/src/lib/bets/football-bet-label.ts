/**
 * When the user changes a football match-odds pick, rewrite the old club
 * in a pick title so Backed follows the current selection, not the first pick.
 * Fixture titles ("Home v Away") stay put.
 */
import { teamSelectionLabel } from "@/lib/markets";
import {
  footballTeamsMatch,
  parseFootballEventSides,
} from "@/lib/services/exchange/football-match";

/** True for any "Home v Away" / "Home vs Away" line, even before teams are filled. */
function looksLikeFixtureTitle(label: string): boolean {
  return parseFootballEventSides(label) != null;
}

/**
 * Selection sync used to replace every occurrence of the old club. A fixture
 * title "Chelsea v Leeds" then became "Leeds v Leeds" when the pick moved.
 * Restore those collapsed titles from the linked event.
 */
export function repairCollapsedFootballFixtureLabel(
  label: string,
  homeTeam?: string | null,
  awayTeam?: string | null
): string {
  const home = homeTeam?.trim() ?? "";
  const away = awayTeam?.trim() ?? "";
  if (!home || !away || footballTeamsMatch(home, away)) return label;
  const sides = parseFootballEventSides(label);
  if (!sides) return label;
  if (!footballTeamsMatch(sides.left, sides.right)) return label;
  return `${home} v ${away}`;
}

export function syncFootballBetLabelOnSelectionChange(
  label: string,
  previousSelection: string,
  nextSelection: string,
  homeTeam: string,
  awayTeam: string
): string {
  const prev = previousSelection.trim();
  const next = nextSelection.trim();
  if (!prev || !next || !label.trim()) return label;
  if (prev.toLowerCase() === next.toLowerCase()) return label;
  if (looksLikeFixtureTitle(label)) return label;

  const prevName = teamSelectionLabel(prev, homeTeam, awayTeam);
  const nextName = teamSelectionLabel(next, homeTeam, awayTeam);
  if (!prevName || !nextName) return label;
  if (footballTeamsMatch(prevName, nextName)) return label;
  if (prevName === "Home" || prevName === "Away" || prevName === "Draw") return label;
  if (!label.includes(prevName)) return label;
  return label.split(prevName).join(nextName);
}
