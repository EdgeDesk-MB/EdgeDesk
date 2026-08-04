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
import { chunkMarketIds } from "./format-exchange-error";
import { matchHorsesByName } from "./horse-match";

const IDENTITY_URL = "https://identitysso.betfair.com/api/login";
const BETTING_URL = "https://api.betfair.com/exchange/betting/rest/v1.0";

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

let cachedToken: { token: string; at: number } | null = null;

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

function formatLoginError(status?: string, error?: string): string {
  const code = (error ?? status ?? "").toUpperCase();
  if (code.includes("STRONG_AUTH_CODE_REQUIRED")) {
    return (
      "Betfair requires 2FA. Add BETFAIR_TOTP_SECRET to .env.local " +
      "(the base32 secret from your Authenticator app setup - not the 6-digit code), " +
      "then restart the server and test again."
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
      message: "Set BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD in .env.local",
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
    throw new Error(formatLoginError(data.status, data.error) || `Betfair login failed (${res.status})`);
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
    ex?: {
      availableToLay?: Array<{ price: number; size: number }>;
      availableToBack?: Array<{ price: number; size: number }>;
    };
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
      maxResults: 400,
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
  const books: MarketBookRow[] = [];

  if (marketIds.length > 0) {
    try {
      for (const batch of chunkMarketIds(marketIds)) {
        const batchBooks = await betfairPost<MarketBookRow[]>("listMarketBook", {
          marketIds: batch,
          priceProjection: { priceData: ["EX_BEST_OFFERS"] },
        });
        books.push(...batchBooks);
      }
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
    };
  });
}

/** Reset cached session - for tests */
export function resetBetfairSession(): void {
  cachedToken = null;
}
