"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Liveline } from "liveline";
import { Activity } from "lucide-react";
import { ChartBetMarkersOverlay } from "@/components/dashboard/chart-bet-markers-overlay";
import {
  ALL_WINDOW_SECS,
  allTimeWindowSecs,
  formatChartTime,
  PnlChartWindowPills,
  useChartPlotCover,
} from "@/components/dashboard/live-pnl-chart";
import { EmptyState } from "@/components/help/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterPill } from "@/components/ui/filter-pill";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { formatAdminDateTime } from "@/lib/admin/format";
import {
  buildActivityTimeline,
  filterActivityEvents,
  type ActivityEvent,
  type ActivityKind,
  type ActivityKindFilter,
} from "@/lib/admin/activity-charts";
import { DEFAULT_BRAND_ACCENT_HEX } from "@/lib/brand-accent-constants";
import {
  chartWindowAnchorValue,
  ensureWindowLinePoints,
  PNL_CHART_PADDING_PANEL,
} from "@/lib/pnl/chart-bet-markers";
import {
  adminChartPlot,
  adminChartPlotCompact,
  filterPillCountState,
  filterPillGroup,
} from "@/lib/ui/surface-styles";
import {
  resolveCssColor,
  useLivelineHoverOutline,
} from "@/lib/ui/liveline-tooltip-outline";
import { cn } from "@/lib/utils";

const DEFAULT_WINDOW_SECS = 86_400;

const KIND_PILLS: Array<{
  key: ActivityKindFilter;
  label: string;
  tone?: "default" | "edge" | "profit";
  emptyTitle: string;
}> = [
  { key: "all", label: "All", emptyTitle: "No recent rows" },
  { key: "bets", label: "Bets", emptyTitle: "No bets" },
  { key: "offers", label: "Offers", tone: "edge", emptyTitle: "No sports offers" },
  { key: "casino", label: "Casino", tone: "profit", emptyTitle: "No casino campaigns" },
];

const MARKER_CLASS: Record<ActivityKind, string> = {
  bets: "chart-bet-marker chart-bet-marker--brand",
  offers: "chart-bet-marker chart-bet-marker--edge",
  casino: "chart-bet-marker chart-bet-marker--profit",
};

const LEGEND: Array<{ kind: ActivityKind; label: string; swatch: string }> = [
  { kind: "bets", label: "Bets", swatch: "bg-brand/70" },
  { kind: "offers", label: "Offers", swatch: "bg-edge/70" },
  { kind: "casino", label: "Casino", swatch: "bg-profit/70" },
];

function useCssColor(token: string, fallback: string): string {
  const { resolvedTheme } = useTheme();
  const [color, setColor] = useState(fallback);
  useEffect(() => {
    const resolved = resolveCssColor(`var(${token})`);
    setColor(resolved && resolved !== "rgba(0, 0, 0, 0)" ? resolved : fallback);
  }, [token, fallback, resolvedTheme]);
  return color;
}

function kindCount(events: ActivityEvent[], kind: ActivityKind): number {
  return events.reduce((sum, event) => sum + (event.kind === kind ? 1 : 0), 0);
}

export function AdminActivityChart({
  events,
  compact = false,
}: {
  events: ActivityEvent[];
  compact?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<ActivityKindFilter>("all");
  const [chartWindowSecs, setChartWindowSecs] = useState(DEFAULT_WINDOW_SECS);
  const [nowTick, setNowTick] = useState(() => Date.now() / 1000);
  const chartHostRef = useRef<HTMLDivElement>(null);
  const isDark = resolvedTheme === "dark";
  const brandColor = useCssColor(
    isDark ? "--brand" : "--brand-highlight",
    DEFAULT_BRAND_ACCENT_HEX
  );
  const edgeColor = useCssColor("--edge", DEFAULT_BRAND_ACCENT_HEX);
  const profitColor = useCssColor("--profit", DEFAULT_BRAND_ACCENT_HEX);
  const lineColor =
    kind === "offers" ? edgeColor : kind === "casino" ? profitColor : brandColor;

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now() / 1000), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useLivelineHoverOutline(chartHostRef, mounted && !isDark);

  const visibleEvents = useMemo(
    () => filterActivityEvents(events, kind),
    [events, kind]
  );
  const timeline = useMemo(
    () => buildActivityTimeline(visibleEvents, nowTick),
    [visibleEvents, nowTick]
  );
  const liveTotal = timeline.points.at(-1)?.value ?? 0;
  const effectiveWindowSecs = useMemo(() => {
    if (chartWindowSecs !== ALL_WINDOW_SECS) return chartWindowSecs;
    return allTimeWindowSecs(timeline.points, nowTick);
  }, [chartWindowSecs, timeline.points, nowTick]);
  const { plotCoverSecs, fillToLeftEdge } = useChartPlotCover(
    chartWindowSecs,
    effectiveWindowSecs
  );
  const chartReferenceValue = useMemo(
    () =>
      chartWindowAnchorValue(timeline.points, effectiveWindowSecs, {
        showBadge: false,
        anchorAtZero: chartWindowSecs === ALL_WINDOW_SECS,
      }),
    [timeline.points, effectiveWindowSecs, chartWindowSecs]
  );
  const chartPoints = useMemo(
    () =>
      ensureWindowLinePoints(timeline.points, plotCoverSecs, {
        nowSec: nowTick,
        showBadge: false,
        fillToLeftEdge,
        liveValue: liveTotal,
      }),
    [timeline.points, plotCoverSecs, nowTick, fillToLeftEdge, liveTotal]
  );

  const emptyTitle =
    events.length === 0
      ? "No recent rows"
      : KIND_PILLS.find((pill) => pill.key === kind)?.emptyTitle ?? "No recent rows";
  const emptyDescription =
    events.length === 0
      ? "Created bets, sports offers, and casino campaigns from the last 60 days appear here as a running line."
      : "This kind has no created rows in the last 60 days. Switch to All to see the rest.";

  return (
    <Card>
      <CardHeader className={compact ? "gap-2" : "gap-3"}>
        <div className="min-w-0">
          <CardTitle className="text-base">Desk activity</CardTitle>
          <CardDescription compact={compact}>
            {compact
              ? "Rows created in the last 60 days."
              : "Running count of rows created in the last 60 days. Each marker is one bet, sports offer, or casino campaign, at the time it was written."}
          </CardDescription>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className={cn(filterPillGroup, "min-w-0")} role="group" aria-label="Activity kind">
            {KIND_PILLS.map((pill) => {
              const count =
                pill.key === "all" ? events.length : kindCount(events, pill.key);
              const hasCount = count > 0;
              const windowLabel = `${pill.label}, last 60 days`;
              return (
                <FilterPill
                  key={pill.key}
                  active={kind === pill.key}
                  tone={pill.tone}
                  hasCount={hasCount}
                  title={windowLabel}
                  aria-label={windowLabel}
                  onClick={() => setKind(pill.key)}
                >
                  {pill.label}
                  {hasCount ? (
                    <span className={filterPillCountState(kind === pill.key)}>
                      {count}
                    </span>
                  ) : null}
                </FilterPill>
              );
            })}
          </div>
          <div className="min-w-0 sm:max-w-[18rem] sm:shrink-0">
            <PnlChartWindowPills
              value={chartWindowSecs}
              onChange={setChartWindowSecs}
              fadeClassName="from-card"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visibleEvents.length === 0 ? (
          <div
            className={cn(
              "flex items-center justify-center",
              compact ? adminChartPlotCompact : adminChartPlot
            )}
          >
            <EmptyState
              compact
              icon={Activity}
              title={emptyTitle}
              description={emptyDescription}
              className="shadow-none"
            />
          </div>
        ) : (
          <>
            <div
              ref={chartHostRef}
              className={cn(
                "relative isolate",
                compact ? adminChartPlotCompact : adminChartPlot
              )}
            >
              {mounted ? (
                <>
                  <Liveline
                    key={`${resolvedTheme}-${kind}`}
                    data={chartPoints}
                    value={liveTotal}
                    theme={isDark ? "dark" : "light"}
                    color={lineColor}
                    window={effectiveWindowSecs}
                    momentum={false}
                    pulse={false}
                    badge={false}
                    showValue={false}
                    padding={{
                      left: PNL_CHART_PADDING_PANEL.left,
                      right: PNL_CHART_PADDING_PANEL.right,
                    }}
                    referenceLine={{ value: chartReferenceValue }}
                    emptyText="Created rows appear here as desks log bets, sports offers, and casino campaigns."
                    formatValue={(v) =>
                      Math.round(v).toLocaleString("en-GB")
                    }
                    formatTime={(t) => formatChartTime(effectiveWindowSecs, t)}
                    scrub={isMobile === true ? false : undefined}
                    className="h-full w-full"
                  />
                  <ChartBetMarkersOverlay
                    markers={timeline.markers}
                    livePoints={chartPoints}
                    ledgerPoints={timeline.points}
                    liveValue={liveTotal}
                    windowSecs={effectiveWindowSecs}
                    activeWindowSecs={chartWindowSecs}
                    showBadge={false}
                    referenceValue={chartReferenceValue}
                    padding={PNL_CHART_PADDING_PANEL}
                    nowSec={nowTick}
                    hrefForMarker={() => null}
                    classNameForMarker={(marker) =>
                      MARKER_CLASS[timeline.kindsById[marker.id] ?? "casino"]
                    }
                    tooltipDetail={(marker) =>
                      formatAdminDateTime((marker.eventTimeSec ?? marker.settledAtSec) * 1000)
                    }
                    ariaLabelForMarker={(marker) =>
                      `${marker.label}, ${formatAdminDateTime((marker.eventTimeSec ?? marker.settledAtSec) * 1000)}`
                    }
                  />
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    compact
                    busy
                    className="shadow-none"
                    title="Loading chart"
                    description="Activity over time appears here once the chart is ready."
                  />
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <ul className="flex min-w-0 flex-wrap items-center gap-3">
                {LEGEND.filter(
                  (item) => kind === "all" || item.kind === kind
                ).map((item) => (
                  <li key={item.kind} className="flex items-center gap-1.5">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", item.swatch)}
                      aria-hidden
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
              <span className="shrink-0 tabular-nums">
                Now {liveTotal.toLocaleString("en-GB")}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
