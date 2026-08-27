/**
 * Unified exchange lay-odds feed - respects Settings default exchange.
 */
import { db, exchanges } from "@/lib/db";
import {
  betfairConfigured,
  betfairConnectionStatus,
  betfairFeedType,
  fetchBetfairLayOdds,
  testBetfairConnection,
} from "./betfair";
import {
  betdaqConfigured,
  betdaqConnectionStatus,
  fetchBetdaqLayOdds,
} from "./betdaq";
import type {
  ExchangeConnectionStatus,
  ExchangeProvider,
  ExchangeProviderStatus,
  ExchangeRaceContext,
  ExchangeOddsResult,
} from "./types";

export type {
  ExchangeConnectionStatus,
  ExchangeLayQuote,
  ExchangeOddsResult,
  ExchangeOddsSource,
  ExchangeProvider,
  ExchangeProviderStatus,
  ExchangeRaceContext,
  ExchangeRaceOdds,
} from "./types";

export { betfairConfigured, resetBetfairSession, testBetfairConnection } from "./betfair";
export { fetchBetfairFootballOdds } from "./football-odds";
export type { FootballOddsQuery, FootballOddsResult } from "./football-odds-map";
export { betdaqConfigured } from "./betdaq";

/** Map Settings exchange name → API provider id. */
export { exchangeNameToProvider } from "./client";
import { exchangeNameToProvider } from "./client";

export function getDefaultExchangeProvider(): ExchangeProvider {
  const rows = db.select().from(exchanges).all();
  const def = rows.find((e) => e.isDefault) ?? rows[0];
  if (!def) return "betfair";
  return exchangeNameToProvider(def.name) ?? "betfair";
}

export function getDefaultExchangeName(): string {
  const rows = db.select().from(exchanges).all();
  const def = rows.find((e) => e.isDefault) ?? rows[0];
  return def?.name ?? "Betfair";
}

/**
 * Provider used for live lay odds.
 * @param overrideProvider - Racing Desk page override (Settings default still used app-wide).
 * When override is set, use it if connected; otherwise fall back to Settings default /
 * first connected feed (Betfair delayed is the usual free path).
 */
export function resolveLiveExchangeProvider(overrideProvider?: ExchangeProvider | null): {
  provider: ExchangeProvider;
  name: string;
  status: ExchangeProviderStatus;
  /** True when Desk override is active (even if we fell back for connectivity). */
  deskOverride?: ExchangeProvider | null;
} {
  const settingsDefault = getDefaultExchangeProvider();
  const preferred = overrideProvider ?? settingsDefault;

  const preferredStatus = getExchangeProviderStatus(preferred);
  if (preferredStatus.status === "connected") {
    return {
      provider: preferred,
      name: providerDisplayName(preferred),
      status: preferredStatus,
      deskOverride: overrideProvider ?? null,
    };
  }

  // If Desk asked for a specific feed that isn't connected, don't silently swap
  // unless there's no override (Settings path may fall back to Betfair).
  if (overrideProvider) {
    return {
      provider: preferred,
      name: providerDisplayName(preferred),
      status: preferredStatus,
      deskOverride: overrideProvider,
    };
  }

  const fallbackOrder: ExchangeProvider[] = ["betfair", "betdaq", "matchbook", "smarkets"];
  for (const provider of fallbackOrder) {
    if (provider === preferred) continue;
    const status = getExchangeProviderStatus(provider);
    if (status.status === "connected") {
      return {
        provider,
        name: providerDisplayName(provider),
        status,
        deskOverride: null,
      };
    }
  }

  return {
    provider: preferred,
    name: getDefaultExchangeName(),
    status: preferredStatus,
    deskOverride: null,
  };
}

function providerDisplayName(provider: ExchangeProvider): string {
  const rows = db.select().from(exchanges).all();
  const match = rows.find((e) => exchangeNameToProvider(e.name) === provider);
  if (match) return match.name;
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Brand colours for an exchange provider (Desk override or Settings default). */
export function getExchangeColors(provider?: ExchangeProvider | null): {
  backColor: string;
  layColor: string;
  brandColor: string;
} {
  const rows = db.select().from(exchanges).all();
  const match = provider
    ? rows.find((e) => exchangeNameToProvider(e.name) === provider)
    : undefined;
  const def = match ?? rows.find((e) => e.isDefault) ?? rows[0];
  return {
    backColor: def?.backColor ?? "#a6d8ff",
    layColor: def?.layColor ?? "#fac9d1",
    brandColor: def?.brandColor ?? "#ffb80c",
  };
}

/** @deprecated Prefer getExchangeColors - kept for callers that mean Settings default. */
export function getDefaultExchangeColors(): {
  backColor: string;
  layColor: string;
  brandColor: string;
} {
  return getExchangeColors(null);
}

export function getExchangeProviderStatus(provider: ExchangeProvider): ExchangeProviderStatus {
  switch (provider) {
    case "betfair": {
      const status = betfairConnectionStatus();
      return {
        provider,
        status: status === "connected" ? "connected" : "not_configured",
        feedType: betfairConfigured() ? betfairFeedType() : undefined,
        message:
          status === "not_configured"
            ? "Exchange feed is not connected."
            : `Betfair ${betfairFeedType()} feed`,
      };
    }
    case "betdaq": {
      const status = betdaqConnectionStatus();
      return {
        provider,
        status,
        message: "Live prices are not available for this exchange yet.",
      };
    }
    default:
      return {
        provider,
        status: "unsupported",
        message: "Live prices are not available for this exchange yet.",
      };
  }
}

export function getAllExchangeProviderStatuses(): ExchangeProviderStatus[] {
  return (["betfair", "betdaq", "matchbook", "smarkets"] as ExchangeProvider[]).map(
    getExchangeProviderStatus
  );
}

export type ExchangeConnectionTestResult = ExchangeProviderStatus & {
  ok: boolean;
  testedAt: string;
};

export async function testExchangeConnections(): Promise<{
  providers: ExchangeConnectionTestResult[];
}> {
  const testedAt = new Date().toISOString();
  const providers: ExchangeConnectionTestResult[] = [];

  const betfair = await testBetfairConnection();
  providers.push({
    provider: "betfair",
    status: betfair.status,
    feedType: betfair.feedType,
    message: betfair.message,
    ok: betfair.ok,
    testedAt,
  });

  for (const provider of ["betdaq", "matchbook", "smarkets"] as ExchangeProvider[]) {
    const status = getExchangeProviderStatus(provider);
    providers.push({
      ...status,
      ok: status.status === "connected",
      testedAt,
    });
  }

  return { providers };
}

export async function getExchangeOdds(
  provider: ExchangeProvider,
  races: ExchangeRaceContext[],
  dateIso: string
): Promise<ExchangeOddsResult> {
  const providerStatus = getExchangeProviderStatus(provider);

  if (providerStatus.status === "not_configured" || providerStatus.status === "unsupported") {
    return {
      provider,
      status: providerStatus.status,
      feedType: providerStatus.feedType,
      races: races.map((r) => ({
        externalId: r.externalId,
        quotes: [],
        source: "estimated" as const,
        error: providerStatus.message,
      })),
      error: providerStatus.message,
    };
  }

  try {
    const raceOdds =
      provider === "betfair"
        ? await fetchBetfairLayOdds(races, dateIso)
        : provider === "betdaq"
          ? await fetchBetdaqLayOdds(races)
          : races.map((r) => ({
              externalId: r.externalId,
              quotes: [],
              source: "estimated" as const,
              error: "Exchange API not supported",
            }));

    const hasLive = raceOdds.some((r) => r.quotes.length > 0);
    return {
      provider,
      status: hasLive ? "connected" : "disconnected",
      feedType: providerStatus.feedType,
      races: raceOdds,
      error: hasLive ? undefined : raceOdds[0]?.error,
    };
  } catch (e) {
    return {
      provider,
      status: "disconnected",
      feedType: providerStatus.feedType,
      races: races.map((r) => ({
        externalId: r.externalId,
        quotes: [],
        source: "estimated" as const,
        error: String(e),
      })),
      error: String(e),
    };
  }
}
