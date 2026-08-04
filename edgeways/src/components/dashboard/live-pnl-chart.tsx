"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Liveline } from "liveline";
import { Radio, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoneyFlow } from "@/components/money-flow";
import { cn } from "@/lib/utils";
import { dashboardSection } from "@/lib/ui/dashboard-layout";
import { cardInsetX } from "@/lib/ui/layout-spacing";
import { ChartBetMarkersOverlay } from "@/components/dashboard/chart-bet-markers-overlay";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import type { BetRow } from "@/lib/db/schema";
import { formatClockTime } from "@/lib/time-format";
import {
  anchorSeriesAtZero,
  PNL_CHART_PADDING_DEFAULT,
  PNL_CHART_PADDING_PANEL,
  type ChartCasinoSettlement,
  type PnlAdjustment,
} from "@/lib/pnl/chart-bet-markers";
import { filterPillState } from "@/lib/ui/surface-styles";

export interface LivePnlPoint {
  time: number;
  value: number;
}

/** Retained = net of exchange commission (real money); gross adds commission back. */
type PnlBasis = "retained" | "gross";

const PNL_BASES = [
  { key: "retained", label: "Retained" },
  { key: "gross", label: "Gross" },
] as const;

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

const DEFAULT_CHART_WINDOW = ALL_WINDOW_SECS;

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
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [livePoints, setLivePoints] = useState<LivePnlPoint[]>([]);
  const [chartWindowSecs, setChartWindowSecs] = useState<number>(DEFAULT_CHART_WINDOW);
  const [pnlBasis, setPnlBasis] = useState<PnlBasis>("retained");
  const lastBasisRef = useRef<PnlBasis>("retained");

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Gross = retained + cumulative commission paid. Open positions carry the
  // last settled cumulative figure (their commission is not yet known).
  const grossOffset =
    pnlBasis === "gross" ? (historicSeries.at(-1)?.commissionPaid ?? 0) : 0;
  const displayTotal = liveTotal + grossOffset;

  useEffect(() => {
    const nowSec = Date.now() / 1000;
    const gross = pnlBasis === "gross";
    // commissionPaid arrives already cumulative from the series build - add, never re-sum.
    const historic = historicSeries.map((p) => ({
      time: p.time / 1000,
      value: gross ? p.value + (p.commissionPaid ?? 0) : p.value,
    }));
    const basisChanged = lastBasisRef.current !== pnlBasis;
    lastBasisRef.current = pnlBasis;
    setLivePoints((prev) => {
      const lastHistTime = historic.at(-1)?.time ?? 0;
      const liveTail = basisChanged ? [] : prev.filter((p) => p.time > lastHistTime + 0.5);
      const tail = [...liveTail, { time: nowSec, value: displayTotal }].slice(-3600);
      return anchorSeriesAtZero([...historic, ...tail], nowSec);
    });
  }, [historicSeries, liveTotal, pnlBasis, displayTotal]);

  const isDark = resolvedTheme === "dark";
  const chartColor = useMemo(
    () => pnlChartColor(displayTotal, isDark),
    [displayTotal, isDark]
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
  const markerPadding = panel ? PNL_CHART_PADDING_PANEL : PNL_CHART_PADDING_DEFAULT;

  const body = (
    <>
      {panel ? (
        <>
          <DashboardSectionHeader
            prominent
            className="bg-page"
            icon={hasLiveEvent ? Radio : undefined}
            iconClassName={
              hasLiveEvent ? "animate-pulse text-emerald-600" : undefined
            }
            title={hasLiveEvent ? "Live Chart" : "Chart"}
            description="P&L streams while tracked events are in play."
          />
          <div className={cn("shrink-0 border-b border-border/60", cardInsetX)}>
            <div className="flex items-center justify-between gap-2 py-2">
              <TooltipProvider delayDuration={200}>
                <div className="flex shrink-0 gap-1">
                  {PNL_BASES.map((b) => (
                    <Tooltip key={b.key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            filterPillState(pnlBasis === b.key),
                            "shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] leading-none"
                          )}
                          onClick={() => setPnlBasis(b.key)}
                        >
                          {b.label}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[14rem] text-xs">
                        {b.key === "gross"
                          ? "Before exchange commission - shows what commission costs you"
                          : "Net of exchange commission - real money"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
              <div className="flex justify-end gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {CHART_WINDOWS.map((w) => (
                  <button
                    key={w.label}
                    type="button"
                    className={cn(
                      filterPillState(
                        w.secs === ALL_WINDOW_SECS ? isAllSelected : chartWindowSecs === w.secs
                      ),
                      "shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] leading-none",
                      w.desktopOnly && "hidden sm:inline-flex"
                    )}
                    onClick={() => setChartWindowSecs(w.secs)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <CardHeader className={cn("shrink-0 pb-2", (compact || mini) && "py-3", mini && "py-2")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle
                className={cn(
                  "flex items-center gap-2 font-semibold uppercase tracking-wide",
                  mini ? "text-xs" : "text-sm"
                )}
              >
                <TrendingUp className="size-4 text-primary" />
                Running profit
              </CardTitle>
              {!mini && (
                <CardDescription compact className="mt-0.5">
                  Live while tracked events are in play - 2UP swings show here instantly.
                </CardDescription>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
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
          <div className={cn("relative isolate min-h-0 flex-1", !panel && "h-full")}>
            {mounted ? (
              <Liveline
                key={`${resolvedTheme}-${pnlBasis}`}
                data={livePoints}
                value={displayTotal}
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
                referenceLine={{ value: 0 }}
                emptyText="Profit updates appear here as bets settle and events go live."
                formatValue={(v) => `£${v.toFixed(2)}`}
                formatTime={(t) => formatChartTime(effectiveWindowSecs, t)}
              />
            ) : (
              <div className="flex h-full min-h-[8rem] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground">
                Loading chart…
              </div>
            )}
            {mounted &&
            (bets.length > 0 || adjustments.length > 0 || casinoSettlements.length > 0) ? (
              <ChartBetMarkersOverlay
                bets={bets}
                adjustments={adjustments}
                casinoSettlements={casinoSettlements}
                livePoints={livePoints}
                liveValue={displayTotal}
                windowSecs={effectiveWindowSecs}
                activeWindowSecs={chartWindowSecs}
                showBadge={!panel}
                padding={markerPadding}
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
