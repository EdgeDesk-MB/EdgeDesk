"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Liveline } from "liveline";
import { Radio, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyFlow } from "@/components/money-flow";
import { cn } from "@/lib/utils";
import { dashboardSection } from "@/lib/ui/dashboard-layout";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useLivelineHoverOutline } from "@/lib/ui/liveline-tooltip-outline";
import { ChartBetMarkersOverlay } from "@/components/dashboard/chart-bet-markers-overlay";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import type { BetRow } from "@/lib/db/schema";
import { formatClockTime } from "@/lib/time-format";
import {
  anchorSeriesAtZero,
  chartPlotCoverSecs,
  chartWindowAnchorValue,
  ensureWindowLinePoints,
  PNL_CHART_PADDING_DEFAULT,
  PNL_CHART_PADDING_PANEL,
  PNL_CHART_WINDOW_TRANSITION_MS,
  shouldLingerChartPlotCover,
  type ChartCasinoSettlement,
  type PnlAdjustment,
} from "@/lib/pnl/chart-bet-markers";
import { FilterPill } from "@/components/ui/filter-pill";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { EmptyState } from "@/components/help/empty-state";

export interface LivePnlPoint {
  time: number;
  value: number;
}

const ALL_WINDOW_SECS = 0;

const CHART_WINDOWS: ReadonlyArray<{
  label: string;
  secs: number;
  /** Hidden below the `sm` breakpoint to keep the mobile chip row tight. */
  desktopOnly?: true;
}> = [
  { label: "24h", secs: 86_400 },
  { label: "This week", secs: 604_800 },
  { label: "This month", secs: 2_592_000, desktopOnly: true },
  { label: "All", secs: ALL_WINDOW_SECS },
];

export const DEFAULT_CHART_WINDOW = ALL_WINDOW_SECS;

export function PnlChartWindowPills({
  value,
  onChange,
}: {
  value: number;
  onChange: (secs: number) => void;
}) {
  const isAllSelected = value === ALL_WINDOW_SECS;
  return (
    <ScrollFadeEdges
      orientation="horizontal"
      className="min-w-0 w-full flex-none"
      fadeClassName="from-page"
      scrollClassName="flex justify-end gap-1"
    >
      {CHART_WINDOWS.map((w) => (
        <FilterPill
          key={w.label}
          compact
          active={w.secs === ALL_WINDOW_SECS ? isAllSelected : value === w.secs}
          onClick={() => onChange(w.secs)}
          className={cn(
            "shrink-0 whitespace-nowrap",
            w.desktopOnly && "hidden sm:inline-flex"
          )}
        >
          {w.label}
        </FilterPill>
      ))}
    </ScrollFadeEdges>
  );
}

/** Liveline draws y-axis labels at `w - pad.right + 8` (11px mono). */
const PANEL_CHART_PADDING = { left: 16, right: 72 } as const;
/** Liveline shifts the time window right by `window * buffer` for the live tip. */
const LIVELINE_TIME_BUFFER = 0.015;
/** Keep the first point inset from the left fade (~40px) so it stays visible. */
const LIVELINE_LEFT_EDGE_MARGIN = 0.06;

/**
 * Matches MoneyFlow / Profit pill greens & reds.
 * Liveline only parses hex/rgb - CSS vars fall back to grey.
 */
const PNL_CHART_COLORS = {
  light: { profit: "#059669", loss: "#e7000b" },
  dark: { profit: "#34d399", loss: "#ff8d8b" },
} as const;

function pnlChartColor(value: number, dark: boolean): string {
  const palette = dark ? PNL_CHART_COLORS.dark : PNL_CHART_COLORS.light;
  return value < -0.004 ? palette.loss : palette.profit;
}

/** Span from first data point through now (All), padded so the first point clears Liveline's left fade. */
function allTimeWindowSecs(points: LivePnlPoint[], nowSec = Date.now() / 1000): number {
  const first = points[0]?.time;
  if (first == null) return 86_400;
  const dataSpan = Math.max(300, Math.ceil(nowSec - first) + 120);
  return Math.ceil(dataSpan / (1 - LIVELINE_TIME_BUFFER - LIVELINE_LEFT_EDGE_MARGIN));
}

function formatChartTime(secs: number, t: number): string {
  const d = new Date(t * 1000);
  if (secs >= 604_800) {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  if (secs >= 86_400) {
    return `${d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
    })}, ${formatClockTime(d)}`;
  }
  if (secs >= 3600) {
    return formatClockTime(d);
  }
  return formatClockTime(d, { withSeconds: true });
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Keep the previous (wider) series on screen while Liveline zooms the viewport
 * in. Set during render so the first frame of a shrink is not already clipped.
 */
function useChartPlotCover(chartWindowSecs: number, effectiveWindowSecs: number) {
  const isAllSelected = chartWindowSecs === ALL_WINDOW_SECS;
  const prevUserWindowRef = useRef(chartWindowSecs);
  const prevViewportRef = useRef(effectiveWindowSecs);
  const [lingerCover, setLingerCover] = useState<{
    secs: number;
    fromAll: boolean;
  } | null>(null);

  const prevUserWindow = prevUserWindowRef.current;
  const prevViewportSecs = prevViewportRef.current;
  if (prevUserWindow !== chartWindowSecs) {
    prevUserWindowRef.current = chartWindowSecs;
    const nextLinger = shouldLingerChartPlotCover(
      prevViewportSecs,
      effectiveWindowSecs,
      prefersReducedMotion()
    )
      ? { secs: prevViewportSecs, fromAll: prevUserWindow === ALL_WINDOW_SECS }
      : null;
    if (lingerCover?.secs !== nextLinger?.secs || lingerCover?.fromAll !== nextLinger?.fromAll) {
      setLingerCover(nextLinger);
    }
  }
  prevViewportRef.current = effectiveWindowSecs;

  useEffect(() => {
    if (lingerCover == null) return;
    const timer = window.setTimeout(() => {
      setLingerCover(null);
    }, PNL_CHART_WINDOW_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [lingerCover]);

  return {
    plotCoverSecs: chartPlotCoverSecs(effectiveWindowSecs, lingerCover?.secs ?? null),
    fillToLeftEdge: !isAllSelected && lingerCover?.fromAll !== true,
  };
}

export const LivePnlChart = memo(function LivePnlChart({
  liveTotal,
  historicSeries,
  bets = [],
  adjustments = [],
  casinoSettlements = [],
  compact = true,
  mini = false,
  panel = false,
  /** Pulsing live dot + momentum arrows - off when nothing is in-play */
  liveInPlay = true,
  /** Live event in play - switches header to Live Chart + green Radio icon */
  hasLiveEvent = false,
  /** Mobile Summary embed: no second section header. Window pills live in the Summary header. */
  embed = false,
  windowSecs: windowSecsProp,
  onWindowChange,
  className,
}: {
  liveTotal: number;
  historicSeries: Array<{ time: number; value: number; commissionPaid?: number }>;
  bets?: BetRow[];
  adjustments?: PnlAdjustment[];
  casinoSettlements?: ChartCasinoSettlement[];
  compact?: boolean;
  /** Shorter chart for dashboard - sits below the live panels */
  mini?: boolean;
  /** Fills grid cell - pairs with live tabs in dashboard row */
  panel?: boolean;
  liveInPlay?: boolean;
  hasLiveEvent?: boolean;
  embed?: boolean;
  windowSecs?: number;
  onWindowChange?: (secs: number) => void;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [livePoints, setLivePoints] = useState<LivePnlPoint[]>([]);
  const [localWindowSecs, setLocalWindowSecs] = useState<number>(DEFAULT_CHART_WINDOW);
  const chartWindowSecs = windowSecsProp ?? localWindowSecs;
  const setChartWindowSecs = onWindowChange ?? setLocalWindowSecs;
  const [nowTick, setNowTick] = useState(() => Date.now() / 1000);
  const chartHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now() / 1000), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const ledgerPoints = useMemo(
    () =>
      historicSeries.map((p) => ({
        // Series is epoch ms; tolerate a seconds-already payload.
        time: p.time > 1e12 ? p.time / 1000 : p.time,
        value: p.value,
      })),
    [historicSeries]
  );

  // Chart always shows retained P&L (net of exchange commission).
  useEffect(() => {
    const nowSec = Date.now() / 1000;
    setLivePoints((prev) => {
      const lastHistTime = ledgerPoints.at(-1)?.time ?? 0;
      const liveTail = prev.filter((p) => p.time > lastHistTime + 0.5);
      const tail = [...liveTail, { time: nowSec, value: liveTotal }].slice(-3600);
      return anchorSeriesAtZero([...ledgerPoints, ...tail], nowSec);
    });
  }, [ledgerPoints, liveTotal]);

  const isDark = resolvedTheme === "dark";
  useLivelineHoverOutline(chartHostRef, mounted && !isDark);
  const chartColor = useMemo(
    () => pnlChartColor(liveTotal, isDark),
    [liveTotal, isDark]
  );

  const effectiveWindowSecs = useMemo(() => {
    if (chartWindowSecs !== ALL_WINDOW_SECS) return chartWindowSecs;
    return allTimeWindowSecs(livePoints);
  }, [chartWindowSecs, livePoints]);

  const livelineWindows = useMemo(
    () =>
      CHART_WINDOWS.map((w) =>
        w.secs === ALL_WINDOW_SECS ? { label: w.label, secs: effectiveWindowSecs } : { ...w }
      ),
    [effectiveWindowSecs]
  );

  const isAllSelected = chartWindowSecs === ALL_WINDOW_SECS;
  const { plotCoverSecs, fillToLeftEdge } = useChartPlotCover(
    chartWindowSecs,
    effectiveWindowSecs
  );
  const markerPadding = panel ? PNL_CHART_PADDING_PANEL : PNL_CHART_PADDING_DEFAULT;
  const showBadge = !panel;
  const chartReferenceValue = useMemo(
    () =>
      chartWindowAnchorValue(livePoints, effectiveWindowSecs, {
        showBadge,
        anchorAtZero: isAllSelected,
      }),
    [livePoints, effectiveWindowSecs, showBadge, isAllSelected]
  );
  const chartPoints = useMemo(
    () =>
      ensureWindowLinePoints(livePoints, plotCoverSecs, {
        nowSec: nowTick,
        showBadge,
        fillToLeftEdge,
        liveValue: liveTotal,
      }),
    [livePoints, plotCoverSecs, showBadge, nowTick, fillToLeftEdge, liveTotal]
  );

  const windowPills = (
    <PnlChartWindowPills value={chartWindowSecs} onChange={setChartWindowSecs} />
  );

  const body = (
    <>
      {panel && !embed ? (
        <DashboardSectionHeader
          prominent
          className="bg-page"
          icon={hasLiveEvent ? Radio : undefined}
          iconClassName={
            hasLiveEvent
              ? "animate-pulse text-profit motion-reduce:animate-none"
              : undefined
          }
          title={hasLiveEvent ? "Live chart" : "Chart"}
          description="P&L after exchange commission. Streams while tracked events are in play."
          action={windowPills}
        />
      ) : embed ? null : (
        <CardHeader className={cn("shrink-0 pb-2", (compact || mini) && "py-3", mini && "py-2")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle
                className={cn(
                  "flex items-center gap-2 font-semibold uppercase tracking-wide",
                  mini ? "text-xs" : "text-sm"
                )}
              >
                <TrendingUp className="size-4 text-primary-text" />
                Running profit
              </CardTitle>
              {!mini && (
                <CardDescription compact className="mt-0.5">
                  Live while tracked events are in play - 2UP swings show here instantly.
                </CardDescription>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Live P&L
              </div>
              <MoneyFlow
                value={liveTotal}
                signColor
                className={cn("font-semibold tabular-nums", mini ? "text-base" : "text-lg")}
              />
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent
        className={cn(
          "pb-3",
          (compact || mini || panel) && "pt-0",
          panel && "flex min-h-0 flex-1 flex-col !px-0",
          !panel && "px-[var(--layout-card-x)]"
        )}
      >
        <div
          className={cn(
            panel &&
              "live-pnl-chart-host live-pnl-chart-host--no-windows min-h-0 flex-1",
            mini && "h-[6.5rem] max-h-[6.5rem]",
            !panel && !mini && compact && "h-[11rem] max-h-[11rem]",
            !panel && !mini && !compact && "h-[min(22rem,40vh)] max-h-[min(22rem,40vh)] min-h-[12rem]"
          )}
        >
          <div
            ref={chartHostRef}
            className={cn("relative isolate min-h-0 flex-1", !panel && "h-full")}
          >
            {mounted ? (
              <Liveline
                key={resolvedTheme}
                data={chartPoints}
                value={liveTotal}
                theme={isDark ? "dark" : "light"}
                color={chartColor}
                momentum={liveInPlay}
                pulse={liveInPlay}
                badge={panel ? false : undefined}
                showValue={false}
                window={effectiveWindowSecs}
                padding={panel ? PANEL_CHART_PADDING : undefined}
                className={panel ? "w-full" : undefined}
                {...(!panel && {
                  windows: livelineWindows,
                  onWindowChange: (secs: number) => {
                    const known = CHART_WINDOWS.find(
                      (w) => w.secs === secs && w.secs !== ALL_WINDOW_SECS
                    );
                    setChartWindowSecs(known ? known.secs : ALL_WINDOW_SECS);
                  },
                  windowStyle: "rounded" as const,
                })}
                // Mobile: the chart lives on Summary in the Home swipe deck.
                // Liveline's touch scrub preventDefaults touchmove, which
                // would swallow the deck swipe — so touch scrub stays off
                // on small viewports. Desktop hover scrub is unaffected.
                scrub={isMobile === true ? false : undefined}
                referenceLine={{ value: chartReferenceValue }}
                emptyText="Profit updates appear here as bets settle and events go live."
                formatValue={(v) => `£${v.toFixed(2)}`}
                formatTime={(t) => formatChartTime(effectiveWindowSecs, t)}
              />
            ) : (
              <div className="flex h-full min-h-[8rem] items-center justify-center p-3">
                <EmptyState
                  compact
                  busy
                  className="shadow-none"
                  title="Loading chart"
                  description="Profit updates appear here as bets settle."
                />
              </div>
            )}
            {mounted &&
            (bets.length > 0 || adjustments.length > 0 || casinoSettlements.length > 0) ? (
              <ChartBetMarkersOverlay
                bets={bets}
                adjustments={adjustments}
                casinoSettlements={casinoSettlements}
                livePoints={chartPoints}
                ledgerPoints={ledgerPoints}
                liveValue={liveTotal}
                windowSecs={effectiveWindowSecs}
                activeWindowSecs={chartWindowSecs}
                showBadge={showBadge}
                referenceValue={chartReferenceValue}
                padding={markerPadding}
                nowSec={nowTick}
              />
            ) : null}
          </div>
        </div>
      </CardContent>
    </>
  );

  if (panel) {
    return (
      <section className={cn(dashboardSection, "min-h-0 flex-1", className)}>
        {body}
      </section>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {body}
    </Card>
  );
});
