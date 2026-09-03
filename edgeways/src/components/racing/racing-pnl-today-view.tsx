"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Liveline } from "liveline";
import { ChartNoAxesCombined, Layers2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartBetMarkersOverlay } from "@/components/dashboard/chart-bet-markers-overlay";
import { EmptyState } from "@/components/help/empty-state";
import { MoneyFlow } from "@/components/money-flow";
import { RegionFlag } from "@/components/region-flag";
import { SportIcon } from "@/components/sport-icon";
import { formatClockTime } from "@/lib/time-format";
import { formatGbp } from "@/lib/format-money";
import {
  ensureWindowLinePoints,
  PNL_CHART_PADDING_PANEL,
  type ChartBetMarker,
} from "@/lib/pnl/chart-bet-markers";
import type { RacingDeskPnlDay } from "@/lib/racing-desk/types";
import {
  deskCardShell,
  deskTableBodyCell,
  deskTableHeaderCell,
  deskTableHeaderRow,
  listRow,
  sectionDescription,
  sectionStack,
  sectionTitle,
  tableEdgeEnd,
  tableEdgeStart,
} from "@/lib/ui/surface-styles";
import { useLivelineHoverOutline } from "@/lib/ui/liveline-tooltip-outline";
import { cn } from "@/lib/utils";

/** Liveline needs at least two race steps to read as a day chart. */
const CHART_MIN_RACES = 2;

/**
 * Matches MoneyFlow / Profit pill greens & reds.
 * Liveline only parses hex/rgb - CSS vars fall back to grey.
 * Keep in sync with `live-pnl-chart.tsx`.
 */
const PNL_CHART_COLORS = {
  light: { profit: "#059669", loss: "#e7000b" },
  dark: { profit: "#34d399", loss: "#ff8d8b" },
} as const;

/** Liveline shifts the time window right by `window * buffer` for the live tip. */
const LIVELINE_TIME_BUFFER = 0.015;
/** Keep the first point inset from the left fade (~40px) so it stays visible. */
const LIVELINE_LEFT_EDGE_MARGIN = 0.06;

function pnlChartColor(value: number, dark: boolean): string {
  const palette = dark ? PNL_CHART_COLORS.dark : PNL_CHART_COLORS.light;
  return value < -0.004 ? palette.loss : palette.profit;
}

function racingDayMarkerHref(marker: ChartBetMarker): string {
  if (marker.id < 0) {
    const abs = Math.abs(marker.id);
    if (abs >= 3_000_000) return "/systems";
    if (abs >= 2_000_000) return "/bet-builder";
    return "/acca";
  }
  return `/tracker?highlight=${marker.id}`;
}

/**
 * Liveline always ends its window at wall-clock now. Span from the first tip
 * through now (Home `allTimeWindowSecs`) so afternoon races stay on screen
 * when the desk is opened later in the day.
 */
function dayChartWindowSecs(firstSec: number, nowSec: number): number {
  const dataSpan = Math.max(300, Math.ceil(nowSec - firstSec) + 120);
  return Math.ceil(
    dataSpan / (1 - LIVELINE_TIME_BUFFER - LIVELINE_LEFT_EDGE_MARGIN)
  );
}

export function RacingPnlTodayView({
  report,
  dateLabel,
  onSelectRace,
}: {
  report: RacingDeskPnlDay | null | undefined;
  dateLabel?: string;
  onSelectRace?: (raceExternalId: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const chartHostRef = useRef<HTMLDivElement>(null);
  /** Refresh window + live tip so the line stays pinned to wall-clock now. */
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const dark = resolvedTheme === "dark";
  useLivelineHoverOutline(chartHostRef, mounted && !dark);
  const total = report?.total ?? 0;
  const chartColor = pnlChartColor(total, dark);

  const chart = useMemo(() => {
    const cumulative = report?.cumulative ?? [];
    if (cumulative.length === 0) return null;
    const nowSec = nowTick / 1000;
    const historic = cumulative.map((p) => ({
      time: p.t / 1000,
      value: p.value,
    }));
    const lastHist = historic.at(-1)!;
    // Tip at now (Home live-pnl pattern) so the plateau reaches the live edge.
    const withLive =
      nowSec > lastHist.time + 0.5
        ? [...historic, { time: nowSec, value: total }]
        : historic;
    const windowSecs = dayChartWindowSecs(withLive[0]!.time, nowSec);
    return {
      ledgerPoints: historic,
      points: ensureWindowLinePoints(withLive, windowSecs, {
        nowSec,
        showBadge: false,
        liveValue: total,
      }),
      windowSecs,
    };
  }, [report, total, nowTick]);

  const markers = useMemo(
    () => (report?.markers ?? []) as ChartBetMarker[],
    [report?.markers]
  );

  const rows = report?.rows ?? [];
  const openCount = report?.openCount ?? 0;
  const settledCount = report?.settledCount ?? 0;
  const raceRowCount = rows.filter((row) => row.kind !== "campaign").length;
  const campaignRowCount = rows.filter((row) => row.kind === "campaign").length;
  const empty = rows.length === 0;
  const showChart = rows.length >= CHART_MIN_RACES && chart != null;

  return (
    <div
      className={cn(
        sectionStack,
        "lg:grid lg:grid-cols-2 lg:items-start lg:gap-[var(--layout-stack-gap)]"
      )}
    >
      <Card className={cn(deskCardShell, "order-1 min-w-0 lg:order-2")}>
        <CardHeader className="gap-2 pb-0">
          <CardTitle className="text-base">Day P&L</CardTitle>
          <CardDescription compact>
            By race off time{dateLabel ? ` · ${dateLabel}` : ""}. Accas and
            other multi-race tickets plot at the last racing leg. Open at worst
            case until settled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {empty ? (
            <EmptyState
              compact
              icon={ChartNoAxesCombined}
              title="No racing P&L yet"
              description="Log a racing bet or settle a race for this day to build the chart. Open positions use worst-case outcome until the result lands."
              className="shadow-none"
            />
          ) : showChart ? (
            <div ref={chartHostRef} className="relative isolate h-[18rem]">
              {mounted ? (
                <>
                  <Liveline
                    key={resolvedTheme}
                    data={chart.points}
                    value={total}
                    theme={dark ? "dark" : "light"}
                    color={chartColor}
                    window={chart.windowSecs}
                    momentum={false}
                    pulse={false}
                    badge={false}
                    showValue={false}
                    padding={DAY_CHART_PADDING}
                    referenceLine={{ value: 0 }}
                    emptyText="Profit updates as races settle."
                    formatValue={(v) => formatGbp(v, { signed: true })}
                    formatTime={(t) => formatClockTime(new Date(t * 1000))}
                    className="h-full w-full"
                  />
                  {markers.length > 0 ? (
                    <ChartBetMarkersOverlay
                      markers={markers}
                      livePoints={chart.points}
                      ledgerPoints={chart.ledgerPoints}
                      liveValue={total}
                      windowSecs={chart.windowSecs}
                      activeWindowSecs={chart.windowSecs}
                      showBadge={false}
                      referenceValue={0}
                      nowSec={nowTick / 1000}
                      padding={PNL_CHART_PADDING_PANEL}
                      hrefForMarker={(marker) => racingDayMarkerHref(marker)}
                    />
                  ) : null}
                </>
              ) : (
                <div className="h-full rounded-lg bg-muted/30" />
              )}
            </div>
          ) : (
            <EmptyState
              compact
              icon={ChartNoAxesCombined}
              title="Chart needs two races"
              description="One race is on the board, so there is nothing to plot yet. The day chart appears once two races have racing P&L. The breakdown still shows this race."
              className="shadow-none"
            />
          )}
          {!empty && (
            <p className="mt-[var(--layout-section-y)] border-t border-border/60 pt-[var(--layout-section-y)] text-xs text-muted-foreground">
              {settledCount} settled
              {openCount > 0 ? ` · ${openCount} open at worst case` : ""}
              {raceRowCount > 0
                ? ` · ${raceRowCount} race${raceRowCount === 1 ? "" : "s"}`
                : ""}
              {campaignRowCount > 0
                ? ` · ${campaignRowCount} multi-race`
                : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
        <h3 className={sectionTitle}>P&L breakdown</h3>
        <p className={sectionDescription}>
          By race, in off-time order. Accas and combo tickets count as one bet,
          on their own line when they span more than one race.
        </p>
        {empty ? (
          <EmptyState
            compact
            icon={ChartNoAxesCombined}
            title="Nothing to break down"
            description="Log a racing bet or settle a race for this day to fill this table."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/80">
            <Table className="border-collapse text-sm">
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow
                  className={cn(
                    "hover:bg-transparent data-[state=selected]:bg-transparent",
                    deskTableHeaderRow
                  )}
                >
                  <TableHead
                    className={cn(
                      deskTableHeaderCell,
                      "border-l-0 text-left",
                      tableEdgeStart
                    )}
                  >
                    Race
                  </TableHead>
                  <TableHead className={cn(deskTableHeaderCell, "text-left")}>
                    Bets
                  </TableHead>
                  <TableHead
                    className={cn(
                      deskTableHeaderCell,
                      "border-r-0 text-right",
                      tableEdgeEnd
                    )}
                  >
                    Profit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isCampaign = row.kind === "campaign";
                  const clickable =
                    Boolean(onSelectRace) && Boolean(row.raceExternalId);
                  const time =
                    row.offTime?.trim() ||
                    formatClockTime(new Date(row.startTime));
                  const hasFlag = Boolean(row.region?.trim());
                  const span =
                    isCampaign && (row.spanCount ?? 0) > 1
                      ? `${row.spanCount} races`
                      : null;
                  return (
                    <TableRow
                      key={row.rowId ?? `${row.kind ?? "race"}-${row.eventId}-${row.campaignId ?? 0}`}
                      className={cn(
                        listRow,
                        clickable && "cursor-pointer hover:bg-selection-subtle"
                      )}
                      onClick={
                        clickable
                          ? () => onSelectRace?.(row.raceExternalId!)
                          : undefined
                      }
                    >
                      <TableCell
                        className={cn(
                          deskTableBodyCell,
                          "whitespace-normal",
                          tableEdgeStart
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            {isCampaign ? (
                              <Layers2
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            ) : hasFlag ? (
                              <>
                                <RegionFlag code={row.region} />
                                <SportIcon
                                  sport="horse_racing"
                                  size={14}
                                  className="shrink-0 text-muted-foreground"
                                  title="Horse racing"
                                />
                              </>
                            ) : null}
                            <span className="min-w-0 text-pretty break-words">
                              {isCampaign
                                ? `${row.course}${time ? ` · ${time}` : ""}`
                                : `${time} ${row.course}`}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground text-pretty break-words">
                            {row.raceName}
                            {span ? ` · ${span}` : ""}
                            {row.openCount > 0
                              ? ` · ${row.openCount} open (worst case)`
                              : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          deskTableBodyCell,
                          "tabular-nums text-muted-foreground"
                        )}
                      >
                        {row.betCount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          deskTableBodyCell,
                          "text-right tabular-nums",
                          tableEdgeEnd
                        )}
                      >
                        <MoneyFlow value={row.profit} signColor />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className={cn(listRow, "hover:bg-transparent")}>
                  <TableCell
                    className={cn(
                      deskTableBodyCell,
                      "text-sm font-medium",
                      tableEdgeStart
                    )}
                  >
                    Day total
                  </TableCell>
                  <TableCell
                    className={cn(
                      deskTableBodyCell,
                      "tabular-nums text-muted-foreground"
                    )}
                  >
                    {settledCount + openCount}
                  </TableCell>
                  <TableCell
                    className={cn(
                      deskTableBodyCell,
                      "text-right tabular-nums",
                      tableEdgeEnd
                    )}
                  >
                    <MoneyFlow value={total} signColor className="font-semibold" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Same inset as Home panel chart / PNL_CHART_PADDING_PANEL. */
const DAY_CHART_PADDING = {
  left: PNL_CHART_PADDING_PANEL.left,
  right: PNL_CHART_PADDING_PANEL.right,
} as const;
