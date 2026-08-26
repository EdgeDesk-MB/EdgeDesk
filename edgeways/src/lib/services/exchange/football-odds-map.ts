/**
 * Pure mapping from Betfair soccer catalogues + books → 2UP Desk odds.
 * Client-safe: no Betfair session / env imports.
 */
import {
  footballTeamMatchScore,
  isBttsYesRunner,
  isDrawRunner,
  isOver25Runner,
  scoreFootballEvent,
} from "./football-match";

export type FootballOddsStatus =
  | "live"
  | "suspended"
  | "closed"
  | "not_configured"
  | "unmatched"
  | "error";

export interface FootballOddsQuery {
  homeTeam: string;
  awayTeam: string;
  startTime?: number;
  /** Skip Over 2.5 / BTTS — Home Live Events only needs match-odds backs. */
  matchOddsOnly?: boolean;
}

export interface FootballOddsValues {
  homeBack?: number;
  drawBack?: number;
  awayBack?: number;
  homeLay?: number;
  awayLay?: number;
  over25Back?: number;
  bttsYesBack?: number;
}

export interface FootballOddsResult {
  status: FootballOddsStatus;
  feedType?: "live" | "delayed";
  eventName?: string;
  startTime?: number;
  odds: FootballOddsValues;
  missing: string[];
  error?: string;
  /** Prices came from a cache entry past its TTL because the exchange was unreachable. */
  stale?: boolean;
}

export interface FootballDeskOddsPatch {
  oHomeWin?: number;
  oDraw?: number;
  oAwayWin?: number;
  oLayH?: number;
  oLayA?: number;
  oOver?: number;
  oBtts?: number;
}

export interface FootballCatalogueMarket {
  marketId: string;
  marketName: string;
  marketStartTime?: string;
  event?: { id?: string; name?: string; openDate?: string };
  description?: { marketType?: string };
  runners?: Array<{ selectionId: number; runnerName: string }>;
}

export interface FootballMarketBook {
  marketId: string;
  /** Betfair `listMarketBook` status: OPEN, SUSPENDED, CLOSED, INACTIVE */
  status?: string;
  runners?: Array<{
    selectionId: number;
    status: string;
    ex?: {
      availableToLay?: Array<{ price: number; size: number }>;
      availableToBack?: Array<{ price: number; size: number }>;
    };
  }>;
}

export const FOOTBALL_ODDS_FIELD_LABELS: { key: keyof FootballOddsValues; label: string }[] = [
  { key: "homeBack", label: "home back" },
  { key: "drawBack", label: "draw back" },
  { key: "awayBack", label: "away back" },
  { key: "homeLay", label: "home lay" },
  { key: "awayLay", label: "away lay" },
  { key: "over25Back", label: "Over 2.5" },
  { key: "bttsYesBack", label: "BTTS Yes" },
];

export const ALL_FOOTBALL_ODDS_MISSING = FOOTBALL_ODDS_FIELD_LABELS.map((f) => f.label);

const MIN_EVENT_SCORE = 120;

export type FootballMarketKind = "match_odds" | "over_25" | "btts";

export function footballMarketKind(market: FootballCatalogueMarket): FootballMarketKind | null {
  const type = (market.description?.marketType ?? "").toUpperCase();
  if (type === "MATCH_ODDS") return "match_odds";
  if (type === "OVER_UNDER_25") return "over_25";
  if (type === "BOTH_TEAMS_TO_SCORE") return "btts";

  const name = (market.marketName ?? "").toLowerCase();
  if (name.includes("match odds")) return "match_odds";
  if (name.includes("over/under 2.5") || name.includes("over under 2.5")) return "over_25";
  if (name.includes("both teams to score")) return "btts";
  return null;
}

export function missingFootballOddsFields(odds: FootballOddsValues): string[] {
  return FOOTBALL_ODDS_FIELD_LABELS.filter((f) => {
    const value = odds[f.key];
    return !(typeof value === "number" && value > 1);
  }).map((f) => f.label);
}

/** Betfair match-odds book: parked, settled, or still trading. */
export function betfairBookTrading(
  status?: string | null
): "open" | "suspended" | "closed" | "unknown" {
  const value = (status ?? "").trim().toUpperCase();
  if (value === "OPEN") return "open";
  if (value === "SUSPENDED") return "suspended";
  if (value === "CLOSED") return "closed";
  return "unknown";
}

export function hasAnyFootballOdds(odds: FootballOddsValues): boolean {
  return FOOTBALL_ODDS_FIELD_LABELS.some((f) => {
    const value = odds[f.key];
    return typeof value === "number" && value > 1;
  });
}

export function footballOddsToDeskPatch(odds: FootballOddsValues): FootballDeskOddsPatch {
  const patch: FootballDeskOddsPatch = {};
  if (odds.homeBack && odds.homeBack > 1) patch.oHomeWin = odds.homeBack;
  if (odds.drawBack && odds.drawBack > 1) patch.oDraw = odds.drawBack;
  if (odds.awayBack && odds.awayBack > 1) patch.oAwayWin = odds.awayBack;
  if (odds.homeLay && odds.homeLay > 1) patch.oLayH = odds.homeLay;
  if (odds.awayLay && odds.awayLay > 1) patch.oLayA = odds.awayLay;
  if (odds.over25Back && odds.over25Back > 1) patch.oOver = odds.over25Back;
  if (odds.bttsYesBack && odds.bttsYesBack > 1) patch.oBtts = odds.bttsYesBack;
  return patch;
}

function marketTimeMs(market: FootballCatalogueMarket): number {
  const raw = market.marketStartTime ?? market.event?.openDate ?? 0;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function pickFootballMatchOddsMarket(
  markets: FootballCatalogueMarket[],
  query: FootballOddsQuery
): FootballCatalogueMarket | undefined {
  const scored = markets
    .filter((m) => footballMarketKind(m) === "match_odds")
    .map((market) => ({
      market,
      score: scoreFootballEvent(market.event?.name ?? market.marketName ?? "", query.homeTeam, query.awayTeam),
      time: marketTimeMs(market),
    }))
    .filter((row) => row.score >= MIN_EVENT_SCORE);

  if (scored.length === 0) return undefined;

  const start = query.startTime && Number.isFinite(query.startTime) ? query.startTime : null;
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (start != null) return Math.abs(a.time - start) - Math.abs(b.time - start);
    return a.time - b.time;
  });
  return scored[0]?.market;
}

function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

function bestPrice(
  offers: Array<{ price: number; size: number }> | undefined
): number | undefined {
  const price = offers?.[0]?.price;
  if (!price || price <= 1) return undefined;
  return roundPrice(price);
}

export function extractFootballOdds(
  markets: FootballCatalogueMarket[],
  books: FootballMarketBook[],
  query: FootballOddsQuery
): FootballOddsValues {
  const bookByMarket = new Map(books.map((b) => [b.marketId, b]));
  const odds: FootballOddsValues = {};

  for (const market of markets) {
    const kind = footballMarketKind(market);
    if (!kind) continue;
    const book = bookByMarket.get(market.marketId);
    const nameById = new Map(
      (market.runners ?? []).map((r) => [r.selectionId, r.runnerName])
    );

    for (const runner of book?.runners ?? []) {
      if (runner.status !== "ACTIVE") continue;
      const name = nameById.get(runner.selectionId) ?? "";
      if (!name) continue;
      const back = bestPrice(runner.ex?.availableToBack);
      const lay = bestPrice(runner.ex?.availableToLay);

      if (kind === "match_odds") {
        if (isDrawRunner(name)) {
          if (back) odds.drawBack = back;
          continue;
        }
        if (footballTeamMatchScore(query.homeTeam, name) >= 60) {
          if (back) odds.homeBack = back;
          if (lay) odds.homeLay = lay;
          continue;
        }
        if (footballTeamMatchScore(query.awayTeam, name) >= 60) {
          if (back) odds.awayBack = back;
          if (lay) odds.awayLay = lay;
        }
        continue;
      }

      if (kind === "over_25" && isOver25Runner(name) && back) {
        odds.over25Back = back;
      }
      if (kind === "btts" && isBttsYesRunner(name) && back) {
        odds.bttsYesBack = back;
      }
    }
  }

  return odds;
}
