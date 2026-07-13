"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BetRow } from "@/lib/db/schema";
import { formatGbp } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import {
  buildAdjustmentMarkers,
  buildChartBetMarkers,
  chartBetMarkerClassName,
  computePnlChartLayout,
  projectBetMarkers,
  settlementStatusLabel,
  type LivePnlPoint,
  type PnlAdjustment,
  type PnlChartPadding,
  type ProjectedBetMarker,
} from "@/lib/pnl/chart-bet-markers";

export const ChartBetMarkersOverlay = memo(function ChartBetMarkersOverlay({
  bets,
  adjustments = [],
  livePoints,
  liveValue,
  windowSecs,
  showBadge,
  padding,
}: {
  bets: BetRow[];
  adjustments?: PnlAdjustment[];
  livePoints: LivePnlPoint[];
  liveValue: number;
  windowSecs: number;
  showBadge: boolean;
  padding: PnlChartPadding;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [projected, setProjected] = useState<ProjectedBetMarker[]>([]);

  const markers = useMemo(
    () => [...buildChartBetMarkers(bets), ...buildAdjustmentMarkers(adjustments)],
    [bets, adjustments]
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size.width || !size.height || markers.length === 0) {
      setProjected([]);
      return;
    }

    let raf = 0;
    let lastKey = "";

    const tick = () => {
      const layout = computePnlChartLayout({
        width: size.width,
        height: size.height,
        pad: padding,
        windowSecs,
        showBadge,
        livePoints,
        liveValue,
      });
      const next = layout ? projectBetMarkers(markers, layout, livePoints) : [];
      const key = next
        .map((p) => `${p.marker.kind ?? "bet"}:${p.marker.id}:${p.x.toFixed(1)}:${p.y.toFixed(1)}`)
        .join("|");
      if (key !== lastKey) {
        lastKey = key;
        setProjected(next);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [markers, size, padding, windowSecs, showBadge, livePoints, liveValue]);

  if (markers.length === 0) return null;

  return (
    <div
      ref={hostRef}
      className="chart-bet-marker-layer pointer-events-none absolute inset-0"
      aria-hidden={projected.length === 0}
    >
      <TooltipProvider delayDuration={200}>
        {projected.map(({ marker, x, y }) => {
          const isAdjustment = marker.kind === "adjustment";
          const statusLabel = isAdjustment
            ? "Balance adjustment"
            : settlementStatusLabel(marker.status);
          return (
            <Tooltip key={`${marker.kind ?? "bet"}:${marker.id}`}>
              <TooltipTrigger asChild>
                <Link
                  href={isAdjustment ? "/accounts" : `/tracker?highlight=${marker.id}`}
                  className={cn(
                    chartBetMarkerClassName(marker.tone),
                    marker.tone === "win" && "chart-bet-marker--up",
                    marker.tone === "loss" && "chart-bet-marker--down"
                  )}
                  style={{ left: x, top: y }}
                  aria-label={`${marker.label} - ${statusLabel} ${formatGbp(marker.betProfit, { signed: true })}`}
                >
                  <span className="chart-bet-marker__inner" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[14rem] text-xs">
                <p className="truncate font-medium">{marker.label}</p>
                <p className="text-background/80">
                  {statusLabel}
                  {" · "}
                  {formatGbp(marker.betProfit, { signed: true })}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
});
