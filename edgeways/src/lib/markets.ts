/**
 * Sport → market catalogue for bet entry. `auto` markets settle automatically
 * from the score via the settlement engine; everything else settles manually or
 * through a "The bet wins IF …" trigger.
 */

import { SPORTS, type SportValue } from "@/lib/sports";

export { SPORTS };

export interface MarketDef {
  value: string;
  label: string;
  /** Result engine can settle this market from the score */
  auto?: boolean;
  /** Fixed selection options; free-text selection when omitted */
  options?: string[];
}

const TWO_WAY_MATCH: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"] },
  { value: "handicap", label: "Handicap" },
  { value: "over_under", label: "Over/Under" },
  { value: "other", label: "Other" },
];

const OUTRIGHT: MarketDef[] = [
  { value: "outright", label: "Outright / winner" },
  { value: "top_finish", label: "Top finish" },
  { value: "other", label: "Other" },
];

const RACING_STYLE: MarketDef[] = [
  { value: "win", label: "Winner" },
  { value: "place", label: "Place" },
  { value: "other", label: "Other" },
];

const FOOTBALL_MARKETS: MarketDef[] = [
  { value: "match_odds", label: "Match odds", auto: true, options: ["home", "draw", "away"] },
  { value: "btts", label: "Both teams to score", auto: true, options: ["yes", "no"] },
  { value: "over_under_1_5", label: "Over/Under 1.5 goals", auto: true, options: ["over", "under"] },
  { value: "over_under_2_5", label: "Over/Under 2.5 goals", auto: true, options: ["over", "under"] },
  { value: "over_under_3_5", label: "Over/Under 3.5 goals", auto: true, options: ["over", "under"] },
  { value: "correct_score", label: "Correct score", auto: true },
  { value: "first_goalscorer", label: "First goalscorer" },
  { value: "anytime_goalscorer", label: "Anytime goalscorer" },
  { value: "draw_no_bet", label: "Draw no bet", auto: true, options: ["home", "away"] },
  { value: "double_chance", label: "Double chance", auto: true, options: ["home/draw", "home/away", "draw/away"] },
  { value: "half_time_full_time", label: "Half time / Full time" },
  { value: "other", label: "Other" },
];

const HORSE_RACING_MARKETS_LIST: MarketDef[] = [
  { value: "win", label: "Winner", auto: true },
  { value: "each_way", label: "Each way" },
  { value: "extra_place", label: "Extra place" },
  { value: "place", label: "Place", auto: true },
  { value: "other", label: "Other" },
];

const TENNIS_MARKETS_LIST: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"] },
  { value: "set_betting", label: "Set betting" },
  { value: "other", label: "Other" },
];

const CRICKET_MARKETS: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"] },
  { value: "top_batsman", label: "Top batsman" },
  { value: "top_bowler", label: "Top bowler" },
  { value: "other", label: "Other" },
];

const DARTS_MARKETS: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"] },
  { value: "correct_score", label: "Correct score" },
  { value: "other", label: "Other" },
];

const SPORT_MARKET_OVERRIDES: Partial<Record<SportValue, MarketDef[]>> = {
  football: FOOTBALL_MARKETS,
  horse_racing: HORSE_RACING_MARKETS_LIST,
  tennis: TENNIS_MARKETS_LIST,
  cricket: CRICKET_MARKETS,
  golf: OUTRIGHT,
  darts: DARTS_MARKETS,
  greyhounds: RACING_STYLE,
  motorsport: OUTRIGHT,
  cycling: OUTRIGHT,
  rugby_union: TWO_WAY_MATCH,
  rugby_league: TWO_WAY_MATCH,
  basketball: TWO_WAY_MATCH,
  american_football: TWO_WAY_MATCH,
  boxing: TWO_WAY_MATCH,
  mma: TWO_WAY_MATCH,
  snooker: TWO_WAY_MATCH,
  ice_hockey: TWO_WAY_MATCH,
  volleyball: TWO_WAY_MATCH,
  baseball: TWO_WAY_MATCH,
  esports: TWO_WAY_MATCH,
  other: [{ value: "other", label: "Other" }],
};

function marketsForSport(sport: SportValue): MarketDef[] {
  return SPORT_MARKET_OVERRIDES[sport] ?? TWO_WAY_MATCH;
}

export const MARKETS: Record<string, MarketDef[]> = Object.fromEntries(
  SPORTS.map((s) => [s.value, marketsForSport(s.value)])
);

/** Flat market label lookup across all sports (for display in the bet log). */
export const MARKET_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(MARKETS)
    .flat()
    .map((m) => [m.value, m.label])
);
MARKET_LABELS.two_up = "2UP";

export function marketDef(sport: string, market: string): MarketDef | undefined {
  return (MARKETS[sport] ?? MARKETS.other).find((m) => m.value === market);
}

/** Whether the result engine can settle this market from score / race result. */
export function isAutoSettleMarket(sport: string, market: string): boolean {
  return !!marketDef(sport, market)?.auto;
}

const HORSE_RACING_MARKETS = new Set(["win", "place", "each_way", "extra_place"]);
const TENNIS_MARKETS = new Set(["match_winner", "set_betting"]);
const OUTRIGHT_MARKETS = new Set(["outright", "top_finish"]);

/** Infer sport from a stored market when the linked event is missing or not loaded yet. */
export function inferSportFromBet(
  market: string,
  eventSport?: string | null,
  /** Campaign sport when the bet has no linked event yet (e.g. cricket offer + match_winner). */
  offerSport?: string | null,
  /** Denormalised bets.sport (desk backs, quick-log without event). */
  betSport?: string | null
): string {
  if (eventSport) return eventSport;
  if (betSport?.trim()) return betSport.trim();
  if (offerSport?.trim()) return offerSport.trim();
  if (HORSE_RACING_MARKETS.has(market)) return "horse_racing";
  if (TENNIS_MARKETS.has(market)) return "tennis";
  if (OUTRIGHT_MARKETS.has(market)) return "golf";
  return "football";
}

/** Events eligible for "Link event" on a bet of this sport (includes finished / past). */
export function linkableEventsForSport<
  T extends { sport: string; status: string },
>(events: T[], sport: string): T[] {
  return events.filter((e) => e.sport === sport);
}

/** Whether this market value only exists under a single sport catalogue. */
export function marketBelongsToSport(market: string, sport: string): boolean {
  return (MARKETS[sport] ?? MARKETS.other).some((m) => m.value === market);
}

export function defaultSelection(sport: string, market: string): string {
  if (sport === "football" && market === "correct_score") return "0-0";
  return marketDef(sport, market)?.options?.[0] ?? "";
}

/** Parse a stored correct-score selection like "2-1". */
export function parseCorrectScore(selection: string): { home: number; away: number } | null {
  const m = selection.trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

export function formatCorrectScore(home: number, away: number): string {
  return `${Math.max(0, Math.floor(home))}-${Math.max(0, Math.floor(away))}`;
}

/** Ensure the first letter of a selection label is capitalised for display. */
export function capitaliseSelectionLabel(label: string): string {
  const t = label.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Human label for match-odds style selections using team names. */
export function teamSelectionLabel(
  value: string,
  homeTeam: string,
  awayTeam: string
): string {
  if (value === "home") return capitaliseSelectionLabel(homeTeam.trim() || "Home");
  if (value === "away") return capitaliseSelectionLabel(awayTeam.trim() || "Away");
  if (value === "draw") return "Draw";
  return capitaliseSelectionLabel(value);
}

/** Display a correct-score pick with team names, e.g. "Arsenal 2–1 Liverpool". */
export function formatCorrectScoreLabel(
  selection: string,
  homeTeam: string,
  awayTeam: string
): string {
  const cs = parseCorrectScore(selection);
  if (!cs) return selection;
  const home = homeTeam.trim() || "Home";
  const away = awayTeam.trim() || "Away";
  return `${home} ${cs.home}–${cs.away} ${away}`;
}

/** Format a bet's selection for display in the tracker. */
export function formatBetSelection(
  market: string,
  selection: string,
  homeTeam?: string,
  awayTeam?: string
): string {
  if (!selection) return "";
  const home = homeTeam ?? "";
  const away = awayTeam ?? "";
  if (market === "correct_score") return formatCorrectScoreLabel(selection, home, away);
  if (
    (market === "match_odds" || market === "draw_no_bet" || market === "two_up") &&
    (selection === "home" || selection === "away" || selection === "draw")
  ) {
    return teamSelectionLabel(selection, home, away);
  }
  return selection;
}
