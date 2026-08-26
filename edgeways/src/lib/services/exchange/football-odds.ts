/**
 * Fetch Betfair soccer MATCH_ODDS + Over 2.5 + BTTS for a fixture.
 * Server-only: uses the shared Betfair session.
 */
import {
  betfairConfigured,
  betfairFeedType,
  betfairListMarketBookCached,
  betfairListMarketCatalogue,
} from "./betfair";
import { canonicalizeTeam } from "./football-match";
import { cachedFetch, type PriceCache } from "./price-cache";
import {
  ALL_FOOTBALL_ODDS_MISSING,
  betfairBookTrading,
  extractFootballOdds,
  hasAnyFootballOdds,
  missingFootballOddsFields,
  pickFootballMatchOddsMarket,
  type FootballCatalogueMarket,
  type FootballOddsQuery,
  type FootballOddsResult,
} from "./football-odds-map";

export type {
  FootballDeskOddsPatch,
  FootballOddsQuery,
  FootballOddsResult,
  FootballOddsValues,
} from "./football-odds-map";
export { footballOddsToDeskPatch } from "./football-odds-map";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/** Which markets exist for a fixture changes slowly; prices are cached separately. */
const CATALOGUE_TTL_MS = 5 * 60 * 1000;

/**
 * Catalogue lookups shared by every browser polling `useLiveMatchBacks`. The
 * MATCH_ODDS entry is keyed on the time window alone, so several live matches in
 * the same window share one upstream call; the narrowed TOO_MUCH_DATA retry and
 * the per-event extras get their own keys.
 */
const catalogueCache: PriceCache<FootballCatalogueMarket[]> = new Map();

export function footballOddsTimeWindow(startTime?: number): { from: string; to: string } {
  if (startTime && Number.isFinite(startTime) && startTime > 0) {
    return {
      from: new Date(startTime - TWO_HOURS_MS).toISOString(),
      to: new Date(startTime + TWO_HOURS_MS).toISOString(),
    };
  }
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return {
    from: start.toISOString(),
    to: new Date(start.getTime() + 36 * 60 * 60 * 1000).toISOString(),
  };
}

function emptyResult(
  status: FootballOddsResult["status"],
  error: string,
  extras?: Partial<FootballOddsResult>
): FootballOddsResult {
  return {
    status,
    odds: {},
    missing: ALL_FOOTBALL_ODDS_MISSING,
    error,
    ...extras,
  };
}

async function listMatchOddsCatalogues(
  query: FootballOddsQuery
): Promise<{ markets: FootballCatalogueMarket[]; stale: boolean }> {
  const window = footballOddsTimeWindow(query.startTime);
  const filter: Record<string, unknown> = {
    eventTypeIds: ["1"],
    marketTypeCodes: ["MATCH_ODDS"],
    marketStartTime: window,
  };
  const windowKey = `${window.from}|${window.to}`;
  try {
    const read = await cachedFetch(catalogueCache, `mo:${windowKey}`, CATALOGUE_TTL_MS, () =>
      betfairListMarketCatalogue(filter, { maxResults: 200 })
    );
    return { markets: read.data, stale: read.stale };
  } catch (error) {
    if (!String(error).includes("TOO_MUCH_DATA")) throw error;
    const token =
      canonicalizeTeam(query.homeTeam).split(" ").find((part) => part.length >= 4) ??
      query.homeTeam;
    const read = await cachedFetch(
      catalogueCache,
      `mo:${windowKey}|q=${token}`,
      CATALOGUE_TTL_MS,
      () => betfairListMarketCatalogue({ ...filter, textQuery: token }, { maxResults: 80 })
    );
    return { markets: read.data, stale: read.stale };
  }
}

/** Over 2.5 / BTTS markets for one Betfair event id - the event id is the whole request. */
async function listEventExtraCatalogues(
  eventId: string
): Promise<{ markets: FootballCatalogueMarket[]; stale: boolean }> {
  const read = await cachedFetch(catalogueCache, `ev:${eventId}`, CATALOGUE_TTL_MS, () =>
    betfairListMarketCatalogue(
      {
        eventTypeIds: ["1"],
        eventIds: [eventId],
        marketTypeCodes: ["OVER_UNDER_25", "BOTH_TEAMS_TO_SCORE"],
      },
      { maxResults: 20 }
    )
  );
  return { markets: read.data, stale: read.stale };
}

export async function fetchBetfairFootballOdds(
  query: FootballOddsQuery
): Promise<FootballOddsResult> {
  const homeTeam = query.homeTeam.trim();
  const awayTeam = query.awayTeam.trim();
  if (!homeTeam || !awayTeam) {
    return emptyResult("unmatched", "Home and away team are required");
  }
  if (!betfairConfigured()) {
    return emptyResult("not_configured", "Betfair is not connected on this desk.");
  }

  const feedType = betfairFeedType();

  try {
    const catalogue = await listMatchOddsCatalogues({ homeTeam, awayTeam, startTime: query.startTime });
    let stale = catalogue.stale;
    const picked = pickFootballMatchOddsMarket(catalogue.markets, { homeTeam, awayTeam, startTime: query.startTime });
    if (!picked) {
      return emptyResult("unmatched", "No matching Betfair market", { feedType });
    }

    const eventId = picked.event?.id;
    let extras: FootballCatalogueMarket[] = [];
    if (!query.matchOddsOnly && eventId) {
      const extraCatalogue = await listEventExtraCatalogues(eventId);
      extras = extraCatalogue.markets;
      if (extraCatalogue.stale) stale = true;
    }

    const markets = [picked, ...extras];
    const bookRead = await betfairListMarketBookCached(markets.map((m) => m.marketId));
    const books = bookRead.books;
    if (bookRead.stale) stale = true;
    const odds = extractFootballOdds(markets, books, { homeTeam, awayTeam, startTime: query.startTime });
    const eventName = picked.event?.name;
    const startMs = picked.marketStartTime ? new Date(picked.marketStartTime).getTime() : undefined;
    const matchBook = books.find((book) => book.marketId === picked.marketId);
    const trading = betfairBookTrading(matchBook?.status);

    if (trading === "closed") {
      return emptyResult("closed", "Market closed", {
        feedType,
        eventName,
        startTime: startMs,
      });
    }

    if (trading === "suspended") {
      return {
        status: "suspended",
        feedType,
        eventName,
        startTime: startMs,
        odds,
        missing: missingFootballOddsFields(odds),
        stale: stale || undefined,
      };
    }

    if (!hasAnyFootballOdds(odds)) {
      return emptyResult("unmatched", "No prices returned", {
        feedType,
        eventName,
        startTime: startMs,
      });
    }

    return {
      status: "live",
      feedType,
      eventName,
      startTime: startMs,
      odds,
      missing: missingFootballOddsFields(odds),
      stale: stale || undefined,
    };
  } catch (error) {
    return emptyResult("error", String(error).replace(/^Error:\s*/, ""), { feedType });
  }
}