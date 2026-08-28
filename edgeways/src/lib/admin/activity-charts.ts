import { withoutAdmins } from "@/lib/admin/exclude-admins";
import { excludedIdSet, withoutExcludedAccounts } from "@/lib/admin/exclude-accounts";
import { fillDailySeries } from "@/lib/admin/feed-monitor";
import {
  compareTrailingWindows,
  dailyCountsFromEpochs,
  lastDays,
  rankShare,
  shareSlices,
  SERIES_COMPARE_DAYS,
  SERIES_WINDOW_DAYS,
  type DayCount,
  type PeriodCompare,
  type ShareSlice,
} from "@/lib/admin/series";

export type ActivityChartRow = {
  clerkUserId: string;
  email: string | null;
  plan?: string;
  admin?: boolean;
  bets: number;
  offers: number;
  history: number;
};

export type ActivityStamp = {
  at: number;
  clerkUserId: string;
};

export type ActivityStamps = {
  bets: ActivityStamp[];
  offers: ActivityStamp[];
  history: ActivityStamp[];
};

export type ActivityDaily = {
  bets: DayCount[];
  offers: DayCount[];
  history: DayCount[];
};

export type ActivityCharts = {
  bets30: DayCount[];
  offers30: DayCount[];
  history30: DayCount[];
  kindShare: ShareSlice[];
  deskShare: ShareSlice[];
  week: {
    bets: PeriodCompare;
    offers: PeriodCompare;
    history: PeriodCompare;
  };
};

const DESK_TONES = [
  "brand",
  "edge",
  "success",
  "warning",
  "profit",
  "destructive",
] as const;

function deskLabel(row: ActivityChartRow): string {
  return row.email ?? row.clerkUserId;
}

export function emptyActivityDaily(now: Date = new Date()): ActivityDaily {
  return {
    bets: fillDailySeries([], SERIES_COMPARE_DAYS, now),
    offers: fillDailySeries([], SERIES_COMPARE_DAYS, now),
    history: fillDailySeries([], SERIES_COMPARE_DAYS, now),
  };
}

export function emptyActivityStamps(): ActivityStamps {
  return { bets: [], offers: [], history: [] };
}

function stampsToDaily(
  stamps: ActivityStamp[],
  skipIds: Set<string> | null,
  now: Date
): DayCount[] {
  const epochs = skipIds
    ? stamps.filter((stamp) => !skipIds.has(stamp.clerkUserId)).map((stamp) => stamp.at)
    : stamps.map((stamp) => stamp.at);
  return dailyCountsFromEpochs(epochs, SERIES_COMPARE_DAYS, now);
}

export function scopeActivityView(
  input: {
    rows: ActivityChartRow[];
    stamps: ActivityStamps;
  },
  excludeAdmins: boolean,
  now: Date = new Date(),
  excludedIds: Iterable<string> = []
): { rows: ActivityChartRow[]; daily: ActivityDaily } {
  const rows = withoutExcludedAccounts(
    withoutAdmins(input.rows, excludeAdmins),
    excludedIds
  );
  const skipIds = excludedIdSet(excludedIds);
  if (excludeAdmins) {
    for (const row of input.rows) {
      if (row.admin) skipIds.add(row.clerkUserId);
    }
  }
  const skip = skipIds.size > 0 ? skipIds : null;
  return {
    rows,
    daily: {
      bets: stampsToDaily(input.stamps.bets, skip, now),
      offers: stampsToDaily(input.stamps.offers, skip, now),
      history: stampsToDaily(input.stamps.history, skip, now),
    },
  };
}

export function buildActivityCharts(
  rows: ActivityChartRow[],
  daily: ActivityDaily
): ActivityCharts {
  const betsTotal = rows.reduce((sum, row) => sum + row.bets, 0);
  const offersTotal = rows.reduce((sum, row) => sum + row.offers, 0);
  const historyTotal = rows.reduce((sum, row) => sum + row.history, 0);

  return {
    bets30: lastDays(daily.bets, SERIES_WINDOW_DAYS),
    offers30: lastDays(daily.offers, SERIES_WINDOW_DAYS),
    history30: lastDays(daily.history, SERIES_WINDOW_DAYS),
    kindShare: shareSlices([
      { key: "bets", label: "Bets", value: betsTotal, tone: "brand" },
      { key: "offers", label: "Offers", value: offersTotal, tone: "edge" },
      { key: "history", label: "History", value: historyTotal, tone: "muted" },
    ]),
    deskShare: rankShare(
      rows.map((row) => ({
        key: row.clerkUserId,
        label: deskLabel(row),
        value: row.bets + row.offers + row.history,
      })),
      [...DESK_TONES]
    ),
    week: {
      bets: compareTrailingWindows(daily.bets, 7),
      offers: compareTrailingWindows(daily.offers, 7),
      history: compareTrailingWindows(daily.history, 7),
    },
  };
}

export function buildFlagShare(on: number, off: number): ShareSlice[] {
  return shareSlices([
    { key: "on", label: "On", value: on, tone: "success" },
    { key: "off", label: "Off", value: off, tone: "muted" },
  ]);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Per-desk row counts over the last 7 days, from the stamps already loaded
 * for the daily charts. Keyed by clerkUserId; a desk with no recent rows is
 * simply absent (treat as 0).
 */
export function weeklyCountsByUser(
  stamps: ActivityStamps,
  now: number = Date.now()
): Map<string, number> {
  const cutoff = now - WEEK_MS;
  const counts = new Map<string, number>();
  for (const list of [stamps.bets, stamps.offers, stamps.history]) {
    for (const stamp of list) {
      if (stamp.at < cutoff) continue;
      counts.set(stamp.clerkUserId, (counts.get(stamp.clerkUserId) ?? 0) + 1);
    }
  }
  return counts;
}
