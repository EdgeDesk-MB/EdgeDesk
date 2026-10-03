/**
 * Sport → market catalogue for bet entry. `auto` markets settle automatically
 * from the score via the settlement engine; everything else settles manually or
 * through a "The bet wins IF …" trigger.
 */

import { SPORTS, isKnownSport, type SportValue } from "@/lib/sports";
import { isEpDeskSport } from "@/lib/twoup/bookie-offers";

export { SPORTS, isKnownSport };
export type { SportValue };

export interface MarketDef {
  value: string;
  label: string;
  /** Result engine can settle this market from the score */
  auto?: boolean;
  /** Fixed selection options; free-text selection when omitted */
  options?: string[];
  /**
   * Exactly one selection in this market can win. Lays on different
   * selections of a single-winner market share liability on the exchange,
   * which only locks the worst case (see `calc/shared-liability.ts`).
   *
   * Leave it off whenever two selections can land together, because the
   * exchange then locks both liabilities in full. Place markets (several
   * runners place), Double chance (home/draw and home/away both win when
   * home wins), Anytime goalscorer and Each way / Extra place are the ones
   * that catch people out. `other` is free-text, so never assume.
   */
  singleWinner?: boolean;
}

const TWO_WAY_MATCH: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"], singleWinner: true },
  // Handicap and Over/Under keep no line in the market key and take a
  // free-text selection, so two lays here can be different lines (Over 1.5
  // and Over 2.5) that both lose. The football Over/Under keys name their
  // line, so those are safe to share.
  { value: "handicap", label: "Handicap" },
  { value: "over_under", label: "Over/Under" },
  { value: "other", label: "Other" },
];

/** NBA / NFL / MLB / NHL books list the two-way winner as Moneyline. */
const MONEYLINE_MATCH: MarketDef[] = [
  { value: "match_winner", label: "Moneyline", options: ["home", "away"], singleWinner: true },
  { value: "handicap", label: "Handicap" },
  { value: "over_under", label: "Over/Under" },
  { value: "other", label: "Other" },
];

const OUTRIGHT: MarketDef[] = [
  { value: "outright", label: "Outright / winner", singleWinner: true },
  // Top 5 / top 10: several players land together, so no shared liability.
  { value: "top_finish", label: "Top finish" },
  { value: "other", label: "Other" },
];

const RACING_STYLE: MarketDef[] = [
  { value: "win", label: "Winner", singleWinner: true },
  // Several runners place, so two place lays can both lose.
  { value: "place", label: "Place" },
  { value: "other", label: "Other" },
];

/** Auto-settled football markets are 90-minute / full time. Extra time later. */
const FOOTBALL_MARKETS: MarketDef[] = [
  { value: "match_odds", label: "Match odds", auto: true, options: ["home", "draw", "away"], singleWinner: true },
  { value: "btts", label: "Both teams to score", auto: true, options: ["yes", "no"], singleWinner: true },
  { value: "over_under_1_5", label: "Over/Under 1.5 goals", auto: true, options: ["over", "under"], singleWinner: true },
  { value: "over_under_2_5", label: "Over/Under 2.5 goals", auto: true, options: ["over", "under"], singleWinner: true },
  { value: "over_under_3_5", label: "Over/Under 3.5 goals", auto: true, options: ["over", "under"], singleWinner: true },
  { value: "correct_score", label: "Correct score", auto: true, singleWinner: true },
  { value: "first_goalscorer", label: "First goalscorer", singleWinner: true },
  // Several players score, so two anytime lays can both lose.
  { value: "anytime_goalscorer", label: "Anytime goalscorer" },
  { value: "draw_no_bet", label: "Draw no bet", auto: true, options: ["home", "away"], singleWinner: true },
  // home/draw and home/away both win when home wins, so not single-winner.
  { value: "double_chance", label: "Double chance", auto: true, options: ["home/draw", "home/away", "draw/away"] },
  { value: "half_time_full_time", label: "Half time / Full time", singleWinner: true },
  { value: "other", label: "Other" },
];

const HORSE_RACING_MARKETS_LIST: MarketDef[] = [
  { value: "win", label: "Winner", auto: true, singleWinner: true },
  // Each way and Extra place are win + place composites: a winner also
  // places, so the two halves of the lay can lose together.
  { value: "each_way", label: "Each way" },
  { value: "extra_place", label: "Extra place" },
  { value: "place", label: "Place", auto: true },
  { value: "other", label: "Other" },
];

const TENNIS_MARKETS_LIST: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"], singleWinner: true },
  { value: "set_betting", label: "Set betting", singleWinner: true },
  { value: "other", label: "Other" },
];

const CRICKET_MARKETS: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"], singleWinner: true },
  // Dead heats split a top-batsman / top-bowler market, so leave these out.
  { value: "top_batsman", label: "Top batsman" },
  { value: "top_bowler", label: "Top bowler" },
  { value: "other", label: "Other" },
];

const DARTS_MARKETS: MarketDef[] = [
  { value: "match_winner", label: "Match winner", options: ["home", "away"], singleWinner: true },
  { value: "correct_score", label: "Correct score", singleWinner: true },
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
  basketball: MONEYLINE_MATCH,
  american_football: MONEYLINE_MATCH,
  boxing: TWO_WAY_MATCH,
  mma: TWO_WAY_MATCH,
  snooker: TWO_WAY_MATCH,
  ice_hockey: MONEYLINE_MATCH,
  volleyball: TWO_WAY_MATCH,
  baseball: MONEYLINE_MATCH,
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

/**
 * Early payout only applies to the sport's match-winner market:
 * football Match odds, US-book Moneyline, otherwise Match winner.
 */
export function isEarlyPayoutMarket(sport: string, market: string): boolean {
  if (!isEpDeskSport(sport) || sport === "other") return false;
  if (sport === "football") return market === "match_odds";
  return market === "match_winner";
}

/** Whether the result engine can settle this market from score / race result. */
export function isAutoSettleMarket(sport: string, market: string): boolean {
  return !!marketDef(sport, market)?.auto;
}

/**
 * Market keys where every sport catalogue agrees only one selection can win.
 * Derived from the catalogue, so adding a market cannot silently opt in: a
 * key counts only when it appears somewhere and every entry is flagged.
 */
const SINGLE_WINNER_MARKETS: ReadonlySet<string> = (() => {
  const seen = new Map<string, boolean>();
  for (const def of Object.values(MARKETS).flat()) {
    const agreed = seen.get(def.value);
    const single = def.singleWinner === true;
    seen.set(def.value, agreed === undefined ? single : agreed && single);
  }
  return new Set(
    [...seen.entries()].filter(([, single]) => single).map(([value]) => value)
  );
})();

/**
 * Exactly one selection of this market can win, so lay liabilities on
 * different selections share on the exchange. Unknown markets answer false:
 * reserving both liabilities in full is the safe direction.
 */
export function marketHasSingleWinner(market: string): boolean {
  return SINGLE_WINNER_MARKETS.has(market.trim());
}

/**
 * Home and away are the two sides of a linked fixture, not free-typed names.
 * Football match markets (match odds, BTTS, goalscorer, …) take Everton /
 * Manchester United from the selected event. Racing and outrights do not.
 */
export function marketUsesLinkedEventSides(sport: string, market: string): boolean {
  if (sport === "horse_racing" || sport === "greyhounds") return false;
  if (sport === "golf" || sport === "motorsport" || sport === "cycling") return false;
  if (sport === "football") return market !== "other";
  return !!marketDef(sport, market)?.options?.some((option) => option === "home" || option === "away");
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
): SportValue {
  const pick = (s?: string | null): SportValue | null => {
    const t = s?.trim();
    if (!t) return null;
    return isKnownSport(t) ? t : null;
  };
  return (
    pick(eventSport) ??
    pick(betSport) ??
    pick(offerSport) ??
    (HORSE_RACING_MARKETS.has(market)
      ? "horse_racing"
      : TENNIS_MARKETS.has(market)
        ? "tennis"
        : OUTRIGHT_MARKETS.has(market)
          ? "golf"
          : "football")
  );
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

/** Canonical market-result tokens. Stored lowercase; shown sentence case. */
const MARKET_SELECTION_LABELS: Record<string, string> = {
  home: "Home",
  away: "Away",
  draw: "Draw",
  yes: "Yes",
  no: "No",
  over: "Over",
  under: "Under",
  "home/draw": "Home/Draw",
  "home/away": "Home/Away",
  "draw/away": "Draw/Away",
};

/** Ensure the first letter of a selection label is capitalised for display. */
export function capitaliseSelectionLabel(label: string): string {
  const t = label.trim();
  if (!t) return t;
  const token = MARKET_SELECTION_LABELS[t.toLowerCase()];
  if (token) return token;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Human label for match-odds style selections using team names. */
export function teamSelectionLabel(
  value: string,
  homeTeam: string,
  awayTeam: string
): string {
  const key = value.trim().toLowerCase();
  if (key === "home") return capitaliseSelectionLabel(homeTeam.trim() || "Home");
  if (key === "away") return capitaliseSelectionLabel(awayTeam.trim() || "Away");
  if (key === "draw") return "Draw";
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

const TEAM_SELECTION_MARKETS = new Set([
  "match_odds",
  "match_winner",
  "draw_no_bet",
  "two_up",
  "double_chance",
]);

/** Format a bet's selection for display. Tokens stay lowercase in storage. */
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
  const key = selection.trim().toLowerCase();
  if (
    TEAM_SELECTION_MARKETS.has(market) &&
    (key === "home" || key === "away" || key === "draw")
  ) {
    return teamSelectionLabel(key, home, away);
  }
  return MARKET_SELECTION_LABELS[key] ?? selection;
}
