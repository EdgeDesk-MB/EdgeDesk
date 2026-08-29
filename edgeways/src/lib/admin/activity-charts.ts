import { withoutAdmins } from "@/lib/admin/exclude-admins";
import { excludedIdSet, withoutExcludedAccounts } from "@/lib/admin/exclude-accounts";
import {
  emptyActivityMix,
  filterActivityMix,
  type ActivityMix,
} from "@/lib/admin/activity-mix";
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
import {
  anchorSeriesAtZero,
  buildPnlChartMarkers,
  type ChartBetMarker,
  type LivePnlPoint,
} from "@/lib/pnl/chart-bet-markers";

export type ActivityChartRow = {
  clerkUserId: string;
  email: string | null;
  plan?: string;
  admin?: boolean;
  bets: number;
  offers: number;
  casino: number;
};

export type ActivityStamp = {
  at: number;
  clerkUserId: string;
};

export type ActivityKind = "bets" | "offers" | "casino";

export type ActivityKindFilter = ActivityKind | "all";

export type ActivityEvent = {
  id: number;
  kind: ActivityKind;
  at: number;
  clerkUserId: string;
  email: string | null;
};

export type ActivityTimeline = {
  points: LivePnlPoint[];
  markers: ChartBetMarker[];
  kindsById: Record<number, ActivityKind>;
};

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  bets: "Bet",
  offers: "Offer",
  casino: "Casino",
};

export type ActivityStamps = {
  bets: ActivityStamp[];
  offers: ActivityStamp[];
  casino: ActivityStamp[];
};

export type ActivityDaily = {
  bets: DayCount[];
  offers: DayCount[];
  casino: DayCount[];
};

export type ActivityCharts = {
  bets30: DayCount[];
  offers30: DayCount[];
  casino30: DayCount[];
  kindShare: ShareSlice[];
  deskShare: ShareSlice[];
  week: {
    bets: PeriodCompare;
    offers: PeriodCompare;
    casino: PeriodCompare;
  };
};

const DESK_TONES = [
  "brand",
  "edge",
  "success",
  "warning",
  "muted",
  "destructive",
] as const;

function deskLabel(row: ActivityChartRow): string {
  return row.email ?? row.clerkUserId;
}

export function emptyActivityDaily(now: Date = new Date()): ActivityDaily {
  return {
    bets: fillDailySeries([], SERIES_COMPARE_DAYS, now),
    offers: fillDailySeries([], SERIES_COMPARE_DAYS, now),
    casino: fillDailySeries([], SERIES_COMPARE_DAYS, now),
  };
}

export function emptyActivityStamps(): ActivityStamps {
  return { bets: [], offers: [], casino: [] };
}

export { emptyActivityMix };

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

function filterStamps(
  stamps: ActivityStamps,
  skipIds: Set<string> | null
): ActivityStamps {
  if (!skipIds) return stamps;
  const keep = (stamp: ActivityStamp) => !skipIds.has(stamp.clerkUserId);
  return {
    bets: stamps.bets.filter(keep),
    offers: stamps.offers.filter(keep),
    casino: stamps.casino.filter(keep),
  };
}

export function scopeActivityView(
  input: {
    rows: ActivityChartRow[];
    stamps: ActivityStamps;
    mix?: ActivityMix;
  },
  excludeAdmins: boolean,
  now: Date = new Date(),
  excludedIds: Iterable<string> = []
): {
  rows: ActivityChartRow[];
  daily: ActivityDaily;
  stamps: ActivityStamps;
  mix: ActivityMix;
} {
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
  const stamps = filterStamps(input.stamps, skip);
  return {
    rows,
    stamps,
    mix: filterActivityMix(input.mix ?? emptyActivityMix(), skip),
    daily: {
      bets: stampsToDaily(input.stamps.bets, skip, now),
      offers: stampsToDaily(input.stamps.offers, skip, now),
      casino: stampsToDaily(input.stamps.casino, skip, now),
    },
  };
}

export function activityEventLabel(event: ActivityEvent): string {
  const who = event.email?.trim() || event.clerkUserId;
  return `${ACTIVITY_KIND_LABEL[event.kind]} · ${who}`;
}

export function activityEventsFromStamps(
  stamps: ActivityStamps,
  emailByUser: ReadonlyMap<string, string | null>,
  kind: ActivityKindFilter = "all"
): ActivityEvent[] {
  const lists: Array<[ActivityKind, ActivityStamp[]]> = [
    ["bets", stamps.bets],
    ["offers", stamps.offers],
    ["casino", stamps.casino],
  ];
  const events: ActivityEvent[] = [];
  let id = 1;
  for (const [eventKind, list] of lists) {
    if (kind !== "all" && eventKind !== kind) continue;
    for (const stamp of list) {
      if (!Number.isFinite(stamp.at) || stamp.at <= 0) continue;
      events.push({
        id: id++,
        kind: eventKind,
        at: stamp.at,
        clerkUserId: stamp.clerkUserId,
        email: emailByUser.get(stamp.clerkUserId) ?? null,
      });
    }
  }
  events.sort((a, b) => a.at - b.at || a.id - b.id);
  return events;
}

export function filterActivityEvents(
  events: ActivityEvent[],
  kind: ActivityKindFilter
): ActivityEvent[] {
  if (kind === "all") return events;
  return events.filter((event) => event.kind === kind);
}

/**
 * Running count of desk rows (one step per stamp) plus Home-chart markers
 * on the prior plateau, so dots sit on the Liveline rather than under it.
 */
export function buildActivityTimeline(
  events: ActivityEvent[],
  nowSec: number = Date.now() / 1000
): ActivityTimeline {
  const sorted = [...events].sort((a, b) => a.at - b.at || a.id - b.id);
  const kindsById: Record<number, ActivityKind> = {};
  for (const event of sorted) kindsById[event.id] = event.kind;

  const markers = buildPnlChartMarkers(
    sorted.map((event) => ({
      id: event.id,
      kind: "bet" as const,
      time: event.at,
      amount: 1,
      label: activityEventLabel(event),
      status: "won" as const,
      tone: "neutral" as const,
    }))
  );

  const tips: LivePnlPoint[] = sorted.map((event, index) => ({
    time: event.at / 1000,
    value: index + 1,
  }));
  const last = tips.at(-1)?.value ?? 0;
  const withNow =
    tips.length === 0
      ? [{ time: nowSec, value: 0 }]
      : nowSec > tips.at(-1)!.time + 0.5
        ? [...tips, { time: nowSec, value: last }]
        : tips;

  return {
    points: anchorSeriesAtZero(withNow, nowSec),
    markers,
    kindsById,
  };
}

export function buildActivityCharts(
  rows: ActivityChartRow[],
  daily: ActivityDaily
): ActivityCharts {
  const betsTotal = rows.reduce((sum, row) => sum + row.bets, 0);
  const offersTotal = rows.reduce((sum, row) => sum + row.offers, 0);
  const casinoTotal = rows.reduce((sum, row) => sum + row.casino, 0);

  return {
    bets30: lastDays(daily.bets, SERIES_WINDOW_DAYS),
    offers30: lastDays(daily.offers, SERIES_WINDOW_DAYS),
    casino30: lastDays(daily.casino, SERIES_WINDOW_DAYS),
    kindShare: shareSlices([
      { key: "bets", label: "Bets", value: betsTotal, tone: "brand" },
      { key: "offers", label: "Offers", value: offersTotal, tone: "edge" },
      { key: "casino", label: "Casino", value: casinoTotal, tone: "profit" },
    ]),
    deskShare: rankShare(
      rows.map((row) => ({
        key: row.clerkUserId,
        label: deskLabel(row),
        value: row.bets + row.offers + row.casino,
      })),
      [...DESK_TONES]
    ),
    week: {
      bets: compareTrailingWindows(daily.bets, 7),
      offers: compareTrailingWindows(daily.offers, 7),
      casino: compareTrailingWindows(daily.casino, 7),
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
  for (const list of [stamps.bets, stamps.offers, stamps.casino]) {
    for (const stamp of list) {
      if (stamp.at < cutoff) continue;
      counts.set(stamp.clerkUserId, (counts.get(stamp.clerkUserId) ?? 0) + 1);
    }
  }
  return counts;
}
