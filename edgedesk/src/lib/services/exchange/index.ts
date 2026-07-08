/**
 * Unified exchange lay-odds feed — respects Settings default exchange.
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
export { betdaqConfigured } from "./betdaq";

/** Map Settings exchange name → API provider id. */
export function exchangeNameToProvider(name: string): ExchangeProvider | null {
  const n = name.trim().toLowerCase();
  if (n.includes("betfair")) return "betfair";
  if (n.includes("betdaq")) return "betdaq";
  if (n.includes("matchbook")) return "matchbook";
  if (n.includes("smarkets")) return "smarkets";
  return null;
}

export function getDefaultExchangeProvider(): ExchangeProvider {
  const rows = db.select().from(exchanges).all();
  const def = rows.find((e) => e.isDefault) ?? rows[0];
  if (!def) return "betdaq";
  return exchangeNameToProvider(def.name) ?? "betfair";
}

export function getDefaultExchangeName(): string {
  const rows = db.select().from(exchanges).all();
  const def = rows.find((e) => e.isDefault) ?? rows[0];
  return def?.name ?? "Betdaq";
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
            ? "Set BETFAIR_APP_KEY, BETFAIR_USERNAME, BETFAIR_PASSWORD in .env.local"
            : `Betfair ${betfairFeedType()} feed`,
      };
    }
    case "betdaq": {
      const status = betdaqConnectionStatus();
      return {
        provider,
        status,
        message:
          status === "not_configured"
            ? "Betdaq requires partner API access — configure BETDAQ_API_KEY when available"
            : "Betdaq partner API not yet integrated — use Betfair",
      };
    }
    default:
      return {
        provider,
        status: "unsupported",
        message: `${provider} exchange API not yet supported`,
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
