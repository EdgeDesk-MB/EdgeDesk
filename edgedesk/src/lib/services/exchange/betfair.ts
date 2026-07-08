/**
 * Betfair Exchange API — session login + listMarketCatalogue / listMarketBook.
 *
 * Free dev: request a **Delayed Application Key** at developer.betfair.com.
 * Delayed keys return prices ~1–3 minutes behind live (fine for offer scouting).
 * Live prices require a paid Application Key and may need vendor approval.
 */
import type {
  ExchangeConnectionStatus,
  ExchangeLayQuote,
  ExchangeRaceContext,
  ExchangeRaceOdds,
} from "./types";

const IDENTITY_URL = "https://identitysso.betfair.com/api/login";
const BETTING_URL = "https://api.betfair.com/exchange/betting/rest/v1.0";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

let cachedToken: { token: string; at: number } | null = null;

function credentials(): { appKey: string; username: string; password: string } | null {
  const appKey = process.env.BETFAIR_APP_KEY?.trim();
  const username = process.env.BETFAIR_USERNAME?.trim();
  const password = process.env.BETFAIR_PASSWORD?.trim();
  if (!appKey || !username || !password) return null;
  return { appKey, username, password };
}

export function betfairConfigured(): boolean {
  return !!credentials();
}

export function betfairFeedType(): "live" | "delayed" {
  const key = process.env.BETFAIR_APP_KEY?.trim().toLowerCase() ?? "";
  return key.includes("delay") ? "delayed" : "live";
}

export function betfairConnectionStatus(): ExchangeConnectionStatus {
  if (!credentials()) return "not_configured";
  return "connected";
}

export async function testBetfairConnection(): Promise<{
  ok: boolean;
  status: ExchangeConnectionStatus;
  feedType?: "live" | "delayed";
  message: string;
}> {
  if (!credentials()) {
    return {
      ok: false,
      status: "not_configured",
      message: "Set BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD in .env.local",
    };
  }

  try {
    await login();
    const feedType = betfairFeedType();
    return {
      ok: true,
      status: "connected",
      feedType,
      message: `Betfair login successful (${feedType} feed)`,
    };
  } catch (e) {
    cachedToken = null;
    return {
      ok: false,
      status: "disconnected",
      feedType: betfairFeedType(),
      message: String(e),
    };
  }
}

function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s+/g, " ");
}

function normCourse(course: string): string {
  return normName(course)
    .replace(/\s*\(.*\)$/, "")
    .replace(/\s+racecourse$/, "")
    .replace(/\s+park$/, "");
}

function horseMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const strip = (s: string) => s.replace(/\s*\(.*\)$/, "").trim();
  return strip(na) === strip(nb);
}

async function login(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("Betfair credentials not configured");

  if (cachedToken && Date.now() - cachedToken.at < SESSION_TTL_MS) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({ username: creds.username, password: creds.password });
  const res = await fetch(IDENTITY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-Application": creds.appKey,
    },
    body: body.toString(),
  });

  const data = (await res.json()) as { token?: string; status?: string; error?: string };
  if (!res.ok || !data.token) {
    cachedToken = null;
    throw new Error(data.error ?? data.status ?? `Betfair login failed (${res.status})`);
  }

  cachedToken = { token: data.token, at: Date.now() };
  return data.token;
}

async function betfairPost<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const creds = credentials();
  if (!creds) throw new Error("Betfair credentials not configured");

  const token = await login();
  const res = await fetch(`${BETTING_URL}/${method}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Application": creds.appKey,
      "X-Authentication": token,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Betfair ${method} failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

interface MarketCatalogueRow {
  marketId: string;
  marketName: string;
  marketStartTime: string;
  event?: { id?: string; name?: string; countryCode?: string; openDate?: string };
  runners?: Array<{ selectionId: number; runnerName: string }>;
}

interface MarketBookRow {
  marketId: string;
  runners?: Array<{
    selectionId: number;
    status: string;
    ex?: { availableToLay?: Array<{ price: number; size: number }> };
  }>;
}

function dayWindowMs(dateIso: string): { from: string; to: string } {
  const start = new Date(`${dateIso}T00:00:00Z`);
  const end = new Date(start.getTime() + 86400000);
  return { from: start.toISOString(), to: end.toISOString() };
}

function matchMarket(
  markets: MarketCatalogueRow[],
  race: ExchangeRaceContext
): MarketCatalogueRow | undefined {
  const course = normCourse(race.course);
  const raceStart = race.startTime;
  const toleranceMs = 5 * 60 * 1000;

  const candidates = markets.filter((m) => {
    const eventName = normName(m.event?.name ?? m.marketName ?? "");
    const courseHit =
      eventName.includes(course) ||
      course.includes(eventName.split(" ")[0] ?? "") ||
      normCourse(eventName).includes(course);
    if (!courseHit) return false;

    const marketTime = new Date(m.marketStartTime ?? m.event?.openDate ?? 0).getTime();
    if (!Number.isFinite(marketTime)) return false;
    return Math.abs(marketTime - raceStart) <= toleranceMs;
  });

  if (candidates.length === 0) return undefined;

  return candidates.sort((a, b) => {
    const ta = Math.abs(new Date(a.marketStartTime).getTime() - raceStart);
    const tb = Math.abs(new Date(b.marketStartTime).getTime() - raceStart);
    return ta - tb;
  })[0];
}

export async function fetchBetfairLayOdds(
  races: ExchangeRaceContext[],
  dateIso: string
): Promise<ExchangeRaceOdds[]> {
  if (!credentials()) {
    return races.map((r) => ({
      externalId: r.externalId,
      quotes: [],
      source: "estimated" as const,
      error: "Betfair not configured",
    }));
  }

  const window = dayWindowMs(dateIso);
  let markets: MarketCatalogueRow[];

  try {
    markets = await betfairPost<MarketCatalogueRow[]>("listMarketCatalogue", {
      filter: {
        eventTypeIds: ["7"],
        marketCountries: ["GB", "IE"],
        marketTypeCodes: ["WIN"],
        marketStartTime: window,
      },
      marketProjection: ["RUNNER_DESCRIPTION", "EVENT", "MARKET_START_TIME"],
      maxResults: 200,
      sort: "FIRST_TO_START",
    });
  } catch (e) {
    return races.map((r) => ({
      externalId: r.externalId,
      quotes: [],
      source: "estimated" as const,
      error: String(e),
    }));
  }

  const matched = races.map((race) => ({
    race,
    market: matchMarket(markets, race),
  }));

  const marketIds = [...new Set(matched.map((m) => m.market?.marketId).filter(Boolean))] as string[];
  let books: MarketBookRow[] = [];

  if (marketIds.length > 0) {
    try {
      books = await betfairPost<MarketBookRow[]>("listMarketBook", {
        marketIds,
        priceProjection: { priceData: ["EX_BEST_OFFERS"] },
      });
    } catch (e) {
      return races.map((r) => ({
        externalId: r.externalId,
        quotes: [],
        source: "estimated" as const,
        error: String(e),
      }));
    }
  }

  const bookByMarket = new Map(books.map((b) => [b.marketId, b]));

  return matched.map(({ race, market }) => {
    if (!market) {
      return {
        externalId: race.externalId,
        quotes: [],
        source: "estimated" as const,
        error: "No matching Betfair market",
      };
    }

    const book = bookByMarket.get(market.marketId);
    const runnerNameById = new Map(
      (market.runners ?? []).map((r) => [r.selectionId, r.runnerName])
    );

    const quotes: ExchangeLayQuote[] = [];
    for (const bookRunner of book?.runners ?? []) {
      if (bookRunner.status !== "ACTIVE") continue;
      const lay = bookRunner.ex?.availableToLay?.[0];
      if (!lay || lay.price <= 1) continue;

      const horseName = runnerNameById.get(bookRunner.selectionId) ?? "";
      const matchedRunner = race.runners.find((r) => horseMatch(r.name, horseName));
      if (!matchedRunner) continue;

      quotes.push({
        horseId: matchedRunner.horseId,
        horseName: matchedRunner.name,
        layDecimal: Math.round(lay.price * 100) / 100,
        laySize: lay.size,
        source: "live",
      });
    }

    return {
      externalId: race.externalId,
      marketId: market.marketId,
      quotes,
      source: quotes.length > 0 ? ("live" as const) : ("estimated" as const),
      error: quotes.length === 0 ? "No lay prices returned" : undefined,
    };
  });
}

/** Reset cached session — for tests */
export function resetBetfairSession(): void {
  cachedToken = null;
}
