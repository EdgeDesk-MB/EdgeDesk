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
  ledgerPoints,
  liveValue,
  windowSecs,
  activeWindowSecs,
  showBadge,
  referenceValue = 0,
  padding,
  nowSec,
  hrefForMarker,
  classNameForMarker,
  tooltipDetail,
  ariaLabelForMarker,
}: {
  bets?: BetRow[];
  adjustments?: PnlAdjustment[];
  casinoSettlements?: ChartCasinoSettlement[];
  /** Pre-built markers (e.g. Racing Desk day chart). Skips Home ledger build. */
  markers?: ChartBetMarker[];
  /** Series actually passed to Liveline (windowed staircase included). */
  livePoints: LivePnlPoint[];
  /**
   * Raw historic ledger tips. Markers only sit on these vertices so a
   * densified carry-forward cannot light up All-history markers.
   */
  ledgerPoints?: LivePnlPoint[];
  liveValue: number;
  windowSecs: number;
  /** The user-selected timeframe (not the continuously-drifting "All" bound) - drives the hide/fade below. */
  activeWindowSecs: number;
  showBadge: boolean;
  /** Liveline reference-line value — mirrors the chart floor anchor (0 for All). */
  referenceValue?: number;
  padding: PnlChartPadding;
  /** Same clock Liveline / the window series used. Defaults to now. */
  nowSec?: number;
  /**
   * Return a desk href, or `null` for a non-navigating marker (admin
   * activity). Omit to keep Home / Racing tracker links.
   */
  hrefForMarker?: (marker: ChartBetMarker) => string | null;
  classNameForMarker?: (marker: ChartBetMarker) => string;
  tooltipDetail?: (marker: ChartBetMarker) => string | null;
  ariaLabelForMarker?: (marker: ChartBetMarker) => string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [projected, setProjected] = useState<ProjectedBetMarker[]>([]);

  // Hide markers for the duration of Liveline's window-change animation, then
  // fade them back in over half that time so they don't pop in mid-reflow.
  const prevActiveWindowRef = useRef(activeWindowSecs);
  const [markerFade, setMarkerFade] = useState({ opacity: 1, transition: false });

  useEffect(() => {
    if (prevActiveWindowRef.current === activeWindowSecs) return;
    prevActiveWindowRef.current = activeWindowSecs;
    setProjected([]);
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
    if (!size.width || !size.height || markers.length === 0) {
      setProjected([]);
      return;
    }

    let raf = 0;
    let lastKey: string | null = null;

    const tick = () => {
      const layout = computePnlChartLayout({
        width: size.width,
        height: size.height,
        pad: padding,
        windowSecs,
        showBadge,
        livePoints,
        liveValue,
        nowSec,
        referenceValue,
      });
      const next =
        layout?.hasSufficientData
          ? projectBetMarkers(markers, layout, livePoints, {
              ledgerPoints,
            })
          : [];
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
  }, [
    markers,
    size,
    padding,
    windowSecs,
    showBadge,
    livePoints,
    ledgerPoints,
    liveValue,
    referenceValue,
    nowSec,
  ]);

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
          const href = hrefForMarker ? hrefForMarker(marker) : markerHref(marker);
          const className =
            classNameForMarker?.(marker) ??
            cn(
              chartBetMarkerClassName(marker.tone),
              marker.tone === "win" && "chart-bet-marker--up",
              marker.tone === "loss" && "chart-bet-marker--down"
            );
          const detail =
            tooltipDetail != null
              ? tooltipDetail(marker)
              : `${statusLabel} · ${formatGbp(marker.betProfit, { signed: true })}`;
          const ariaLabel =
            ariaLabelForMarker?.(marker) ??
            `${marker.label} - ${statusLabel} ${formatGbp(marker.betProfit, { signed: true })}`;
          const inner = <span className="chart-bet-marker__inner" />;
          const trigger = href ? (
            <Link
              href={href}
              className={className}
              style={{ left: x, top: y }}
              aria-label={ariaLabel}
            >
              {inner}
            </Link>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              className={cn(className, "appearance-none border-0 p-0 cursor-pointer")}
              style={{ left: x, top: y }}
              aria-label={ariaLabel}
            >
              {inner}
            </button>
          );
          return (
            <Tooltip key={`${marker.kind ?? "bet"}:${marker.id}`}>
              <TooltipTrigger asChild>{trigger}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-[min(14rem,calc(100vw-var(--overlay-gutter)))] text-xs">
                <p className="font-medium text-pretty break-words">{marker.label}</p>
                {detail ? (
                  <p className="text-background/80">{detail}</p>
                ) : null}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
});
