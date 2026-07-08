"use client";

import { memo, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Liveline } from "liveline";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyFlow } from "@/components/money-flow";
import { cn } from "@/lib/utils";
import { dashboardPanelFillBody, dashboardSection } from "@/lib/ui/dashboard-layout";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { filterPillState } from "@/lib/ui/surface-styles";

export interface LivePnlPoint {
  time: number;
  value: number;
}

const CHART_WINDOWS = [
  { label: "5m", secs: 300 },
  { label: "1hr", secs: 3600 },
  { label: "24h", secs: 86_400 },
  { label: "This week", secs: 604_800 },
  { label: "This month", secs: 2_592_000 },
  { label: "All", secs: 31_536_000 },
] as const;

const DEFAULT_CHART_WINDOW = CHART_WINDOWS[0].secs;

function formatChartTime(secs: number, t: number): string {
  const d = new Date(t * 1000);
  if (secs >= 604_800) {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  if (secs >= 86_400) {
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (secs >= 3600) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const LivePnlChart = memo(function LivePnlChart({
  liveTotal,
  historicSeries,
  compact = true,
  mini = false,
  panel = false,
  className,
}: {
  liveTotal: number;
  historicSeries: Array<{ time: number; value: number }>;
  compact?: boolean;
  /** Shorter chart for dashboard — sits below the live panels */
  mini?: boolean;
  /** Fills grid cell — pairs with live tabs in dashboard row */
  panel?: boolean;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [livePoints, setLivePoints] = useState<LivePnlPoint[]>([]);
  const [chartWindowSecs, setChartWindowSecs] = useState<number>(DEFAULT_CHART_WINDOW);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    const nowSec = Date.now() / 1000;
    const historic = historicSeries.map((p) => ({
      time: p.time / 1000,
      value: p.value,
    }));
    setLivePoints((prev) => {
      const lastHistTime = historic.at(-1)?.time ?? 0;
      const liveTail = prev.filter((p) => p.time > lastHistTime + 0.5);
      const tail = [...liveTail, { time: nowSec, value: liveTotal }].slice(-3600);
      return [...historic, ...tail];
    });
  }, [historicSeries, liveTotal]);

  const body = (
    <>
      {panel ? (
        <>
          <DashboardSectionHeader
            icon={TrendingUp}
            title="Running profit"
            description="Live P&L while tracked events are in play."
          />
          <div className="shrink-0 border-b border-border/60 px-[var(--layout-card-x)]">
            <div className="flex gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CHART_WINDOWS.map((w) => (
                <button
                  key={w.secs}
                  type="button"
                  className={cn(
                    filterPillState(chartWindowSecs === w.secs),
                    "shrink-0 whitespace-nowrap px-2.25 py-1 text-[9px] leading-none"
                  )}
                  onClick={() => setChartWindowSecs(w.secs)}
                >
                  {w.label}
                </button>
              ))}
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
                  Live while tracked events are in play — 2UP swings show here instantly.
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
          panel && cn(dashboardPanelFillBody, "px-[var(--layout-card-x)]"),
          !panel && "px-[var(--layout-card-x)]"
        )}
      >
        <div
          className={cn(
            panel && "live-pnl-chart-host live-pnl-chart-host--no-windows min-h-0 flex-1",
            mini && "h-[6.5rem] max-h-[6.5rem]",
            !panel && !mini && compact && "h-[11rem] max-h-[11rem]",
            !panel && !mini && !compact && "h-[min(22rem,40vh)] max-h-[min(22rem,40vh)] min-h-[12rem]"
          )}
        >
          {mounted ? (
            <Liveline
              key={resolvedTheme}
              data={livePoints}
              value={liveTotal}
              theme={resolvedTheme === "dark" ? "dark" : "light"}
              color="var(--primary)"
              momentum
              showValue={false}
              window={chartWindowSecs}
              {...(!panel && {
                windows: [...CHART_WINDOWS],
                onWindowChange: setChartWindowSecs,
                windowStyle: "rounded" as const,
              })}
              emptyText="Profit updates appear here as bets settle and events go live."
              formatValue={(v) => `£${v.toFixed(2)}`}
              formatTime={(t) => formatChartTime(chartWindowSecs, t)}
            />
          ) : (
            <div className="flex h-full min-h-[8rem] items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground">
              Loading chart…
            </div>
          )}
        </div>
      </CardContent>
    </>
  );

  if (panel) {
    return (
      <section className={cn(dashboardSection, className)}>
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
