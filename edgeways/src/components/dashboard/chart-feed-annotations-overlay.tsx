"use client";

/**
 * Alternate chart overlay — feed icons for settlements, goals, 2UP, etc.
 * Not wired to the dashboard UI; kept for a future variant.
 * Active default: `chart-bet-markers-overlay.tsx` (settlement dots).
 */

import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { HistoryEntryIcon } from "@/components/history/history-entry-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HistoryRow } from "@/lib/db/schema";
import { formatGbp } from "@/lib/format-money";
import {
  buildChartAnnotations,
  computePnlChartLayout,
  projectChartAnnotations,
  type LivePnlPoint,
  type PnlChartPadding,
  type ProjectedChartAnnotation,
} from "@/lib/pnl/chart-bet-markers";
import {
  historyEntryLinkLabel,
  type HistoryContext,
} from "@/lib/history-display";
import { cn } from "@/lib/utils";

export const ChartFeedAnnotationsOverlay = memo(function ChartFeedAnnotationsOverlay({
  history,
  ctx,
  livePoints,
  liveValue,
  windowSecs,
  showBadge,
  padding,
}: {
  history: HistoryRow[];
  ctx: HistoryContext;
  livePoints: LivePnlPoint[];
  liveValue: number;
  windowSecs: number;
  showBadge: boolean;
  padding: PnlChartPadding;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [projected, setProjected] = useState<ProjectedChartAnnotation[]>([]);

  const annotations = useMemo(
    () => buildChartAnnotations(history, ctx),
    [history, ctx]
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
    if (!size.width || !size.height || annotations.length === 0) {
      setProjected([]);
      return;
    }

    let raf = 0;
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
      setProjected(layout ? projectChartAnnotations(annotations, layout, livePoints) : []);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [annotations, size, padding, windowSecs, showBadge, livePoints, liveValue]);

  if (annotations.length === 0) return null;

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-[2]">
      <TooltipProvider delayDuration={200}>
        {projected.map(({ annotation, x, y }) => (
          <Tooltip key={annotation.key}>
            <TooltipTrigger asChild>
              <Link
                href={annotation.href}
                className={cn(
                  "pointer-events-auto absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                style={{ left: x, top: y }}
                aria-label={historyEntryLinkLabel(annotation.entry, ctx)}
              >
                <HistoryEntryIcon entry={annotation.entry} ctx={ctx} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[min(14rem,calc(100vw-var(--overlay-gutter)))] text-xs">
              <p className="font-medium text-pretty break-words">{annotation.title}</p>
              {annotation.subtitle ? (
                <p className="text-pretty break-words text-background/80">{annotation.subtitle}</p>
              ) : null}
              {annotation.amount != null ? (
                <p className="text-background/80">
                  {formatGbp(annotation.amount, { signed: true })}
                </p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
});
