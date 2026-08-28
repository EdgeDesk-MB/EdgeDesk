/**
 * Betfair Exchange API - session login + listMarketCatalogue / listMarketBook.
 *
 * Free dev: request a **Delayed Application Key** at developer.betfair.com.
 * Delayed keys return prices ~1–3 minutes behind live (fine for offer scouting).
 * Live prices require a paid Application Key and may need vendor approval.
 *
 * Accounts with 2FA: set BETFAIR_TOTP_SECRET (authenticator base32 secret) so
 * Edgeways can append the current code to the password on login.
 */
import { TOTP } from "otpauth";
import type {
  ExchangeConnectionStatus,
  ExchangeLayQuote,
  ExchangeRaceContext,
  ExchangeRaceOdds,
} from "./types";
import { betfairRunsOnVercelNode } from "./betfair-proxy-auth";
import { chunkMarketIds } from "./format-exchange-error";
import { matchHorsesByName } from "./horse-match";
import { cachedFetch, readFresh, writeEntry, type PriceCache } from "./price-cache";

const IDENTITY_URL = "https://identitysso.betfair.com/api/login";
const BETTING_URL = "https://api.betfair.com/exchange/betting/rest/v1.0";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

/** Market catalogues change slowly: a race is added or abandoned, not repriced. */
const CATALOGUE_TTL_MS = 5 * 60 * 1000;
/** Prices. The delayed app key is already 1-3 minutes behind, so 30s costs no freshness. */
const MARKET_BOOK_TTL_MS = 30 * 1000;

/** Countries in the day WIN catalogue - part of the catalogue cache key. */
const RACING_MARKET_COUNTRIES = ["GB", "IE"];

let cachedToken: { token: string; at: number } | null = null;

const dayCatalogueCache: PriceCache<MarketCatalogueRow[]> = new Map();
const marketBookCache: PriceCache<MarketBookRow> = new Map();

function credentials(): {
  appKey: string;
  username: string;
  password: string;
  totpSecret: string | null;
} | null {
  const appKey = process.env.BETFAIR_APP_KEY?.trim();
  const username = process.env.BETFAIR_USERNAME?.trim();
  const password = process.env.BETFAIR_PASSWORD?.trim();
  const totpSecret = process.env.BETFAIR_TOTP_SECRET?.trim() || null;
  if (!appKey || !username || !password) return null;
  return { appKey, username, password, totpSecret };
}

export function betfairConfigured(): boolean {
  return !!credentials();
}

export function betfairFeedType(): "live" | "delayed" {
  const key = process.env.BETFAIR_APP_KEY?.trim().toLowerCase() ?? "";
  // Delayed keys are often labelled in the developer portal; the key string itself
  // may not contain "delay". Prefer env hint, then key substring.
  const hint = process.env.BETFAIR_FEED_TYPE?.trim().toLowerCase();
  if (hint === "delayed" || hint === "live") return hint;
  return key.includes("delay") ? "delayed" : "delayed";
}

export function betfairConnectionStatus(): ExchangeConnectionStatus {
  if (!credentials()) return "not_configured";
  return "connected";
}

function currentTotpCode(secret: string): string {
  const totp = new TOTP({
    secret: secret.replace(/\s+/g, "").toUpperCase(),
    digits: 6,
    period: 30,
    algorithm: "SHA1",
  });
  return totp.generate();
}

function loginPassword(creds: {
  password: string;
  totpSecret: string | null;
}): string {
  if (!creds.totpSecret) return creds.password;
  return `${creds.password}${currentTotpCode(creds.totpSecret)}`;
}

/**
 * Cloudflare in front of identitysso often serves an HTML challenge to
 * datacentre fetches that look like bare Node. A browser UA is enough to
 * get JSON back from the same host.
 */
function betfairHeaders(contentType: string, token?: string): Record<string, string> {
  const creds = credentials();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": "en-GB,en;q=0.9",
    "Content-Type": contentType,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  };
  if (creds?.appKey) headers["X-Application"] = creds.appKey;
  if (token) headers["X-Authentication"] = token;
  return headers;
}

function betfairProxyOrigin(): string | null {
  const url = process.env.VERCEL_URL?.trim();
  if (url) return url.startsWith("http") ? url : `https://${url}`;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return prod.startsWith("http") ? prod : `https://${prod}`;
  return null;
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

/** Hobby Node runs in Washington; Betfair login IP must match betting IP. */
async function betfairUpstreamFetch(url: string, init: RequestInit): Promise<Response> {
  if (!betfairRunsOnVercelNode()) {
    return fetch(url, init);
  }
  const origin = betfairProxyOrigin();
  const appKey = credentials()?.appKey;
  if (!origin || !appKey) {
    throw new Error("Betfair edge proxy is not configured.");
  }
  return fetch(`${origin}/api/exchange/betfair-proxy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      method: init.method ?? "POST",
      headers: headersToRecord(init.headers),
      body: typeof init.body === "string" ? init.body : String(init.body ?? ""),
    }),
  });
}

function formatLoginError(status?: string, error?: string): string {
  const code = (error ?? status ?? "").toUpperCase();
  if (code.includes("STRONG_AUTH_CODE_REQUIRED")) {
    return (
      "Betfair requires two-factor authentication on this feed. Email support@edgeways.app if you need it connected."
    );
  }
  if (code.includes("CERT_AUTH_REQUIRED")) {
    return "Betfair wants certificate login - interactive username/password login should work with a delayed key; check app key and credentials.";
  }
  return error ?? status ?? "Betfair login failed";
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
      message: "Betfair is not connected on this desk.",
    };
  }

  try {
    await login();
    const feedType = betfairFeedType();
    const hasTotp = !!credentials()?.totpSecret;
    return {
      ok: true,
      status: "connected",
      feedType,
      message: `Betfair login successful (${feedType} feed${hasTotp ? ", 2FA" : ""})`,
    };
  } catch (e) {
    cachedToken = null;
    return {
      ok: false,
      status: "disconnected",
      feedType: betfairFeedType(),
      message: String(e).replace(/^Error:\s*/, ""),
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

async function login(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("Betfair credentials not configured");

  if (cachedToken && Date.now() - cachedToken.at < SESSION_TTL_MS) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    username: creds.username,
    password: loginPassword(creds),
  });
  const res = await betfairUpstreamFetch(IDENTITY_URL, {
    method: "POST",
    headers: betfairHeaders("application/x-www-form-urlencoded"),
    body: body.toString(),
  });

  const data = await readBetfairJson<{ token?: string; status?: string; error?: string }>(
    res,
    "login"
  );
  if (!res.ok || !data.token) {
    cachedToken = null;
    throw new Error(formatLoginError(data.status, data.error) || `Betfair login failed (${res.status})`);
  }

  cachedToken = { token: data.token, at: Date.now() };
  return data.token;
}

async function betfairPost<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const creds = credentials();
  if (!creds) throw new Error("Betfair credentials not configured");

  const token = await login();
  const res = await betfairUpstreamFetch(`${BETTING_URL}/${method}/`, {
    method: "POST",
    headers: betfairHeaders("application/json", token),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Betfair ${method} failed (${res.status}): ${summariseBetfairBody(text)}`
    );
  }

  return readBetfairJson<T>(res, method);
}

/** Betfair/Cloudflare sometimes returns an HTML challenge instead of JSON. */
async function readBetfairJson<T>(res: Response, method: string): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Betfair ${method} returned a web page instead of JSON (${res.status}). ${summariseBetfairBody(text)}`
    );
  }
}

function summariseBetfairBody(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html")) {
    return "The login host served HTML (blocked or challenged from this server).";
  }
  return trimmed.slice(0, 200);
}

export interface MarketCatalogueRow {
  marketId: string;
  marketName: string;
  marketStartTime: string;
  event?: { id?: string; name?: string; countryCode?: string; openDate?: string };
  description?: { marketType?: string };
  runners?: Array<{ selectionId: number; runnerName: string }>;
}

export interface MarketBookRow {
  marketId: string;
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

export async function betfairListMarketCatalogue(
  filter: Record<string, unknown>,
  options?: { maxResults?: number; sort?: string }
): Promise<MarketCatalogueRow[]> {
  return betfairPost<MarketCatalogueRow[]>("listMarketCatalogue", {
    filter,
    marketProjection: ["RUNNER_DESCRIPTION", "EVENT", "MARKET_START_TIME", "MARKET_DESCRIPTION"],
    maxResults: options?.maxResults ?? 200,
    sort: options?.sort ?? "FIRST_TO_START",
  });
}

export async function betfairListMarketBook(marketIds: string[]): Promise<MarketBookRow[]> {
  if (marketIds.length === 0) return [];
  const books: MarketBookRow[] = [];
  for (const batch of chunkMarketIds(marketIds)) {
    const batchBooks = await betfairPost<MarketBookRow[]>("listMarketBook", {
      marketIds: batch,
      priceProjection: { priceData: ["EX_BEST_OFFERS"] },
    });
    books.push(...batchBooks);
  }
  return books;
}

/**
 * Market books through the 30s price cache, one entry per market id. The market
 * id is the whole request (the price projection is fixed), so entries can never
 * be shared between two markets. Ids still inside the TTL are never re-requested;
 * when upstream fails, expired entries are served rather than dropping a market.
 */
export async function betfairListMarketBookCached(
  marketIds: string[]
): Promise<{ books: MarketBookRow[]; stale: boolean }> {
  const unique = [...new Set(marketIds.filter(Boolean))];
  if (unique.length === 0) return { books: [], stale: false };

  const books: MarketBookRow[] = [];
  const missing: string[] = [];
  for (const marketId of unique) {
    const fresh = readFresh(marketBookCache, marketId, MARKET_BOOK_TTL_MS);
    if (fresh) books.push(fresh);
    else missing.push(marketId);
  }
  if (missing.length === 0) return { books, stale: false };

  try {
    const fetched = await betfairListMarketBook(missing);
    for (const book of fetched) writeEntry(marketBookCache, book.marketId, book);
    return { books: [...books, ...fetched], stale: false };
  } catch (error) {
    const expired = missing
      .map((marketId) => marketBookCache.get(marketId)?.data)
      .filter((book): book is MarketBookRow => !!book);
    if (expired.length === 0) throw error;
    return { books: [...books, ...expired], stale: true };
  }
}

function dayWindowMs(dateIso: string): { from: string; to: string } {
  const start = new Date(`${dateIso}T00:00:00Z`);
  const end = new Date(start.getTime() + 86400000);
  return { from: start.toISOString(), to: end.toISOString() };
}

/**
 * The day's WIN catalogue for every open Racing Desk, cached for 5 minutes.
 * Keyed on the only two inputs that change the response: the day window and the
 * countries requested. Race matching downstream is pure, so it is not cached.
 */
async function dayWinCatalogue(
  dateIso: string
): Promise<{ markets: MarketCatalogueRow[]; stale: boolean }> {
  const key = `win:${dateIso}:${RACING_MARKET_COUNTRIES.join(",")}`;
  const read = await cachedFetch(dayCatalogueCache, key, CATALOGUE_TTL_MS, () =>
    betfairPost<MarketCatalogueRow[]>("listMarketCatalogue", {
      filter: {
        eventTypeIds: ["7"],
        marketCountries: RACING_MARKET_COUNTRIES,
        marketTypeCodes: ["WIN"],
        marketStartTime: dayWindowMs(dateIso),
      },
      marketProjection: ["RUNNER_DESCRIPTION", "EVENT", "MARKET_START_TIME"],
      maxResults: 400,
      sort: "FIRST_TO_START",
    })
  );
  return { markets: read.data, stale: read.stale };
}

function matchMarket(
  markets: MarketCatalogueRow[],
  race: ExchangeRaceContext
): MarketCatalogueRow | undefined {
  const course = normCourse(race.course);
  const raceStart = race.startTime;
  // UK off times vs Betfair UTC can drift; also allow offTime string match.
  const toleranceMs = 20 * 60 * 1000;
  const raceOff = (race.offTime ?? "").trim().replace(/^0/, "");

  const candidates = markets.filter((m) => {
    const eventName = normName(m.event?.name ?? "");
    const marketName = normName(m.marketName ?? "");
    const courseHit =
      eventName.includes(course) ||
      course.includes(eventName.split(" ")[0] ?? "") ||
      normCourse(eventName).includes(course) ||
      marketName.includes(course);
    if (!courseHit) return false;

    const marketTime = new Date(m.marketStartTime ?? m.event?.openDate ?? 0).getTime();
    if (!Number.isFinite(marketTime)) return false;

    if (Math.abs(marketTime - raceStart) <= toleranceMs) return true;

    if (raceOff) {
      const londonOff = new Date(marketTime).toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
      });
      const normOff = (s: string) => s.replace(/^0/, "").replace(/\s/g, "");
      if (normOff(londonOff) === normOff(raceOff)) return true;
    }
    return false;
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
      error: "Exchange feed is not connected",
    }));
  }

  let markets: MarketCatalogueRow[];
  let stale = false;

  try {
    const catalogue = await dayWinCatalogue(dateIso);
    markets = catalogue.markets;
    stale = catalogue.stale;
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
  const books: MarketBookRow[] = [];

  if (marketIds.length > 0) {
    try {
      const read = await betfairListMarketBookCached(marketIds);
      books.push(...read.books);
      if (read.stale) stale = true;
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
        error: "No matching exchange market",
      };
    }

    const book = bookByMarket.get(market.marketId);
    const runnerNameById = new Map(
      (market.runners ?? []).map((r) => [r.selectionId, r.runnerName])
    );

    const activeLays: Array<{
      exchangeName: string;
      layDecimal: number;
      laySize: number;
      backDecimal?: number;
      backSize?: number;
    }> = [];
    for (const bookRunner of book?.runners ?? []) {
      if (bookRunner.status !== "ACTIVE") continue;
      const lay = bookRunner.ex?.availableToLay?.[0];
      if (!lay || lay.price <= 1) continue;
      const exchangeName = runnerNameById.get(bookRunner.selectionId) ?? "";
      if (!exchangeName) continue;
      const back = bookRunner.ex?.availableToBack?.[0];
      activeLays.push({
        exchangeName,
        layDecimal: Math.round(lay.price * 100) / 100,
        laySize: lay.size,
        backDecimal: back && back.price > 1 ? Math.round(back.price * 100) / 100 : undefined,
        backSize: back && back.price > 1 ? back.size : undefined,
      });
    }

    const nameToRunner = matchHorsesByName(
      race.runners,
      activeLays.map((l) => l.exchangeName)
    );

    const quotes: ExchangeLayQuote[] = [];
    for (const lay of activeLays) {
      const matchedRunner = nameToRunner.get(lay.exchangeName);
      if (!matchedRunner) continue;
      quotes.push({
        horseId: matchedRunner.horseId,
        horseName: matchedRunner.name,
        layDecimal: lay.layDecimal,
        laySize: lay.laySize,
        backDecimal: lay.backDecimal,
        backSize: lay.backSize,
        source: "live",
      });
    }

    return {
      externalId: race.externalId,
      marketId: market.marketId,
      quotes,
      source: quotes.length > 0 ? ("live" as const) : ("estimated" as const),
      error: quotes.length === 0 ? "No lay prices returned" : undefined,
      stale: stale || undefined,
    };
  });
}

/** Reset cached session - for tests */
export function resetBetfairSession(): void {
  cachedToken = null;
}
