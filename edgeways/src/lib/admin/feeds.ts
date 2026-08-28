import "server-only";
import { and, count, eq, inArray, lt } from "drizzle-orm";
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
import { isNeonDesk } from "@/lib/db/desk-backend";
import { getNeonDb } from "@/lib/db/neon";
import { events as pgEvents } from "@/lib/db/schema.pg";
import {
  neonFeedBudgetUsed,
  neonFeedUsageAttribution,
  neonFeedUsageHistory,
  type FeedUsageDay,
} from "@/lib/db/neon-feed-budget";
import { readFeedCaps, type FeedCaps } from "@/lib/admin/feed-caps";
import {
  feedThresholdState,
  fillDailySeries,
  groupFeedUsageBySource,
  projectDailyPace,
  type FeedSourceSpend,
  type FeedThresholdState,
  type FeedUsageDayPoint,
} from "@/lib/admin/feed-monitor";

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
      feedType?: "live" | "delayed";
    }>;
  };
};

export function mapExchangeProviders(
  rows: Array<{
    provider: string;
    status: string;
    message?: string;
    ok?: boolean;
    feedType?: string;
  }>
): FeedStatus["exchange"]["providers"] {
  return rows.map((row) => ({
    provider: row.provider,
    ok: row.ok ?? row.status === "connected",
    status: row.status,
    message: row.message,
    feedType: row.feedType === "live" || row.feedType === "delayed" ? row.feedType : undefined,
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

export const FEED_MONITOR_HISTORY_DAYS = 30;

export type FeedMonitorLane = {
  used: number;
  cap: number;
  state: FeedThresholdState;
  projected: number;
  capReachedAt: number | null;
  history: FeedUsageDayPoint[];
};

export type FeedMonitor = {
  hosted: boolean;
  caps: FeedCaps;
  football: FeedMonitorLane;
  racing: FeedMonitorLane;
  demand: {
    /** Global API-sourced events currently live — what the poller is polling. */
    liveFootball: number;
    /** API-sourced events still to start before the end of the UTC day. */
    upcomingFootball: number;
  };
};

function monitorLane(
  used: number,
  cap: number,
  history: FeedUsageDay[],
  now: Date
): FeedMonitorLane {
  const pace = projectDailyPace(used, cap, now);
  return {
    used,
    cap,
    state: feedThresholdState(used, cap),
    projected: pace.projected,
    capReachedAt: pace.capReachedAt,
    history: fillDailySeries(history, FEED_MONITOR_HISTORY_DAYS, now),
  };
}

async function countApiEvents(
  statuses: Array<"upcoming" | "live">,
  before?: number
): Promise<number> {
  const conditions = [
    eq(pgEvents.source, "api"),
    inArray(pgEvents.status, statuses),
  ];
  if (before != null) conditions.push(lt(pgEvents.startTime, before));
  const rows = await getNeonDb()
    .select({ value: count() })
    .from(pgEvents)
    .where(and(...conditions));
  return Number(rows[0]?.value ?? 0);
}

/**
 * Cross-instance usage, pace and demand for the admin feed monitor. Local
 * desks have no shared pool to monitor, so history/demand only load hosted.
 */
export async function loadFeedMonitor(): Promise<FeedMonitor> {
  const caps = await readFeedCaps();
  const now = new Date();
  const status = await loadFeedStatus();

  if (!isNeonDesk()) {
    return {
      hosted: false,
      caps,
      football: monitorLane(status.football.used, caps.football, [], now),
      racing: monitorLane(status.racing.used, caps.racing, [], now),
      demand: { liveFootball: 0, upcomingFootball: 0 },
    };
  }

  const endOfDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  const [footballUsed, racingUsed, footballHistory, racingHistory, live, upcoming] =
    await Promise.all([
      neonFeedBudgetUsed(),
      neonFeedBudgetUsed(undefined, "racing"),
      neonFeedUsageHistory("football", FEED_MONITOR_HISTORY_DAYS),
      neonFeedUsageHistory("racing", FEED_MONITOR_HISTORY_DAYS),
      countApiEvents(["live"]),
      countApiEvents(["upcoming"], endOfDay),
    ]);

  return {
    hosted: true,
    caps,
    football: monitorLane(footballUsed, caps.football, footballHistory, now),
    racing: monitorLane(racingUsed, caps.racing, racingHistory, now),
    demand: { liveFootball: live, upcomingFootball: upcoming },
  };
}

export type FeedAttribution = {
  hosted: boolean;
  sources: FeedSourceSpend[];
};

/**
 * Today's spend rolled up by source (signed-in user vs system/poller).
 * Local desks have no shared pool to attribute, so this is hosted-only.
 */
export async function loadFeedAttribution(): Promise<FeedAttribution> {
  if (!isNeonDesk()) return { hosted: false, sources: [] };
  const rows = await neonFeedUsageAttribution();
  return { hosted: true, sources: groupFeedUsageBySource(rows) };
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
