import {
  SERIES_COMPARE_DAYS,
  SERIES_WINDOW_DAYS,
  compareTrailingWindows,
  dailyCountsFromEpochs,
  lastDays,
  shareSlices,
  type AdminChartTone,
  type DayCount,
  type PeriodCompare,
  type ShareSlice,
} from "@/lib/admin/series";
import {
  FEEDBACK_KINDS,
  FEEDBACK_KIND_LABELS,
  type FeedbackKind,
  type FeedbackListItem,
} from "@/lib/feedback/types";

export type InboxCharts = {
  submissions30: DayCount[];
  kindShare: ShareSlice[];
  week: { submissions: PeriodCompare };
};

const KIND_TONE: Record<FeedbackKind, AdminChartTone> = {
  bug: "destructive",
  idea: "brand",
  other: "muted",
};

export function buildInboxCharts(
  reports: FeedbackListItem[],
  now: Date = new Date()
): InboxCharts {
  const all = dailyCountsFromEpochs(
    reports.map((report) => report.createdAt),
    SERIES_COMPARE_DAYS,
    now
  );
  const byKind = new Map<FeedbackKind, number>();
  for (const report of reports) {
    byKind.set(report.kind, (byKind.get(report.kind) ?? 0) + 1);
  }
  return {
    submissions30: lastDays(all, SERIES_WINDOW_DAYS),
    kindShare: shareSlices(
      FEEDBACK_KINDS.map((kind) => ({
        key: kind,
        label: FEEDBACK_KIND_LABELS[kind],
        value: byKind.get(kind) ?? 0,
        tone: KIND_TONE[kind],
      }))
    ),
    week: { submissions: compareTrailingWindows(all, 7) },
  };
}
