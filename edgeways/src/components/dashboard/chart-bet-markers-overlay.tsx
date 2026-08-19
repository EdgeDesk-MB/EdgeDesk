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
  buildHomeChartMarkers,
  chartBetMarkerClassName,
  computePnlChartLayout,
  PNL_CHART_MARKER_FADE_IN_MS,
  PNL_CHART_WINDOW_TRANSITION_MS,
  projectBetMarkers,
  settlementStatusLabel,
  type ChartBetMarker,
  type ChartCasinoSettlement,
  type LivePnlPoint,
  type PnlAdjustment,
  type PnlChartPadding,
  type ProjectedBetMarker,
} from "@/lib/pnl/chart-bet-markers";

function markerStatusLabel(marker: ProjectedBetMarker["marker"]): string {
  if (marker.kind === "adjustment") return "Balance adjustment";
  if (marker.kind === "casino") return "Casino settled";
  return settlementStatusLabel(marker.status);
}

function markerHref(marker: ProjectedBetMarker["marker"]): string {
  if (marker.kind === "adjustment") return "/accounts";
  if (marker.kind === "casino") return "/casino";
  if (marker.label.startsWith("Acca ·") || marker.label.startsWith("Acca FB ·")) {
    return "/acca?tab=history";
  }
  return `/tracker?highlight=${marker.id}`;
}

export const ChartBetMarkersOverlay = memo(function ChartBetMarkersOverlay({
  bets = [],
  adjustments = [],
  casinoSettlements = [],
  markers: markersProp,
  livePoints,
  liveValue,
  windowSecs,
  activeWindowSecs,
  showBadge,
  referenceValue = 0,
  padding,
}: {
  bets?: BetRow[];
  adjustments?: PnlAdjustment[];
  casinoSettlements?: ChartCasinoSettlement[];
  /** Pre-built markers (e.g. Racing Desk day chart). Skips Home ledger build. */
  markers?: ChartBetMarker[];
  livePoints: LivePnlPoint[];
  liveValue: number;
  windowSecs: number;
  /** The user-selected timeframe (not the continuously-drifting "All" bound) - drives the hide/fade below. */
  activeWindowSecs: number;
  showBadge: boolean;
  /** Liveline reference-line value — mirrors the chart floor anchor (0 for All). */
  referenceValue?: number;
  padding: PnlChartPadding;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [projected, setProjected] = useState<ProjectedBetMarker[]>([]);

  // Frozen {min, max} from the last frame that had 2+ in-window points -
  // reused when the window goes sparse so markers don't jump to a
  // mismatched scale relative to Liveline's own (also-frozen) line range.
  const lastGoodRangeRef = useRef<{ min: number; max: number } | null>(null);

  // Hide markers for the duration of Liveline's window-change animation, then
  // fade them back in over half that time so they don't pop in mid-reflow.
  const prevActiveWindowRef = useRef(activeWindowSecs);
  const [markerFade, setMarkerFade] = useState({ opacity: 1, transition: false });

  useEffect(() => {
    if (prevActiveWindowRef.current === activeWindowSecs) return;
    prevActiveWindowRef.current = activeWindowSecs;
    lastGoodRangeRef.current = null;
    setMarkerFade({ opacity: 0, transition: false });
    const timer = window.setTimeout(() => {
      setMarkerFade({ opacity: 1, transition: true });
    }, PNL_CHART_WINDOW_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [activeWindowSecs]);

  const markers = useMemo(
    () =>
      markersProp ??
      buildHomeChartMarkers({ bets, adjustments, casinoSettlements }),
    [markersProp, bets, adjustments, casinoSettlements]
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
    lastGoodRangeRef.current = null;
  }, [windowSecs, referenceValue]);

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
        fallbackRange: lastGoodRangeRef.current ?? undefined,
        referenceValue,
      });
      if (layout?.hasSufficientData) {
        lastGoodRangeRef.current = { min: layout.minVal, max: layout.maxVal };
      }
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
  }, [markers, size, padding, windowSecs, showBadge, livePoints, liveValue, referenceValue]);

  if (markers.length === 0) return null;

  return (
    <div
      ref={hostRef}
      className="chart-bet-marker-layer pointer-events-none absolute inset-0"
      aria-hidden={projected.length === 0}
      style={{
        opacity: markerFade.opacity,
        transition: markerFade.transition
          ? `opacity ${PNL_CHART_MARKER_FADE_IN_MS}ms ease`
          : undefined,
      }}
    >
      <TooltipProvider delayDuration={200}>
        {projected.map(({ marker, x, y }) => {
          const statusLabel = markerStatusLabel(marker);
          return (
            <Tooltip key={`${marker.kind ?? "bet"}:${marker.id}`}>
              <TooltipTrigger asChild>
                <Link
                  href={markerHref(marker)}
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
              <TooltipContent side="top" className="max-w-[min(14rem,calc(100vw-var(--overlay-gutter)))] text-xs">
                <p className="font-medium text-pretty break-words">{marker.label}</p>
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
