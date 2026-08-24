import "server-only";
import {
  DAILY_BUDGET,
  apiUsageTodayAsync,
  hasApiKey,
  pingApiFootball,
} from "@/lib/services/apifootball";
import {
  hasRacingApiKey,
  racingApiUsageToday,
  racecardsFree,
} from "@/lib/services/theracingapi";
import {
  getAllExchangeProviderStatuses,
  testExchangeConnections,
} from "@/lib/services/exchange";

export type FeedStatus = {
  football: {
    configured: boolean;
    used: number;
    budget: number;
  };
  racing: {
    configured: boolean;
    used: number;
  };
  exchange: {
    providers: Array<{
      provider: string;
      ok: boolean;
      status: string;
      message?: string;
    }>;
  };
};

export function mapExchangeProviders(
  rows: Array<{ provider: string; status: string; message?: string; ok?: boolean }>
): FeedStatus["exchange"]["providers"] {
  return rows.map((row) => ({
    provider: row.provider,
    ok: row.ok ?? row.status === "connected",
    status: row.status,
    message: row.message,
  }));
}

export async function loadFeedStatus(): Promise<FeedStatus> {
  const footballUsage = await apiUsageTodayAsync();
  return {
    football: {
      configured: hasApiKey(),
      used: footballUsage.used,
      budget: footballUsage.budget ?? DAILY_BUDGET,
    },
    racing: {
      configured: hasRacingApiKey(),
      used: racingApiUsageToday().used,
    },
    exchange: {
      providers: mapExchangeProviders(getAllExchangeProviderStatuses()),
    },
  };
}

export async function runFeedTest(
  kind: "football" | "racing" | "exchange"
): Promise<{
  ok: boolean;
  message: string;
  providers?: FeedStatus["exchange"]["providers"];
}> {
  if (kind === "football") {
    if (!hasApiKey()) {
      return { ok: false, message: "Football feed key is not set." };
    }
    try {
      // /status is quota-free on API-Football — never spends the daily budget.
      const status = await pingApiFootball();
      const usage = await apiUsageTodayAsync();
      const providerQuota =
        status.requestsUsed != null && status.requestsLimit != null
          ? ` Provider quota ${status.requestsUsed}/${status.requestsLimit} today.`
          : "";
      return {
        ok: true,
        message: `Key OK${status.plan ? ` (${status.plan})` : ""}.${providerQuota} App budget ${usage.used}/${usage.budget ?? DAILY_BUDGET} today.`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Football feed test failed.",
      };
    }
  }

  if (kind === "racing") {
    if (!hasRacingApiKey()) {
      return { ok: false, message: "Racing feed credentials are not set." };
    }
    try {
      // Free-tier racecards: one cached request, no results-API paging.
      const cards = await racecardsFree("today");
      return {
        ok: true,
        message:
          cards.length > 0
            ? `Credentials OK. ${cards.length} meeting${cards.length === 1 ? "" : "s"} on today’s card.`
            : "Credentials OK. No racecards published yet today.",
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Racing feed test failed.",
      };
    }
  }

  try {
    const { providers } = await testExchangeConnections();
    const mapped = mapExchangeProviders(providers);
    const ok = mapped.some((provider) => provider.ok);
    const detail = mapped
      .map((provider) => `${provider.provider}: ${provider.message ?? provider.status}`)
      .join(". ");
    return {
      ok,
      message: detail || "No exchange providers responded.",
      providers: mapped,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Exchange feed test failed.",
    };
  }
}
