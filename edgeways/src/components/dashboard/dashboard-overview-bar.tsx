"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyFlow } from "@/components/money-flow";
import { DashboardPnlSummaries } from "@/components/dashboard/dashboard-pnl-summaries";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { BetRow } from "@/lib/db/schema";
import {
  computePaceStats,
  formatActivitySince,
  formatPaceDayCount,
  type PaceIncomePoint,
} from "@/lib/pnl/pace-stats";
import { homeDeckChartMinH } from "@/lib/ui/layout-spacing";
import { cn } from "@/lib/utils";
import { CalendarRange, Radio } from "lucide-react";

/** Matches History page header band - page-x inset, section-y vertical rhythm */
const overviewInset =
  "px-[var(--layout-page-x)] py-[calc(var(--layout-section-y)/2+12px)]";

function OverviewMetric({
  label,
  value,
  sub,
  href,
  onClick,
  className,
  muted,
  compact,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** Softer secondary metrics (Daily avg. / Yearly est.) */
  muted?: boolean;
  /** Tighter type when the P&L chart shares the Summary card. */
  compact?: boolean;
}) {
  const inner = (
    <>
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-muted-foreground",
          compact ? "text-xs" : "text-sm sm:text-xs"
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          "mt-0.5 tabular-nums leading-none tracking-tight",
          compact ? "text-2xl sm:text-3xl" : "text-4xl sm:text-3xl",
          muted ? "font-medium text-muted-foreground" : "font-bold"
        )}
      >
        {value}
      </div>
      <p className="mt-[3px] min-h-[1rem] text-xs leading-snug text-muted-foreground sm:text-xs">
        {sub}
      </p>
    </>
  );

  const focusRing =
    "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page";
  const shell = cn("flex min-w-0 flex-1 flex-col", className);

  if (href) {
    return (
      <Link href={href} className={cn(shell, focusRing)}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shell, "text-left", focusRing)}>
        {inner}
      </button>
    );
  }

  return <div className={shell}>{inner}</div>;
}

export function DashboardOverviewBar({
  liveTotal,
  settled,
  provisional,
  openBets,
  offers,
  bets,
  casinoSettlements = [],
  pnlAdjustments = [],
  /** Offer / Monthly P&L side chips (home only; tracker has a P&L Breakdown tab). */
  showSideSummaries = true,
  /** Live event in play — same mark the old Chart card used. */
  hasLiveEvent = false,
  /** Mobile: P&L chart sits on Summary instead of its own deck card. */
  chart,
  /** Chart window pills, rendered in the section header like Feed / Do next. */
  headerAction,
}: {
  liveTotal: number;
  settled: number;
  provisional: number;
  openBets: number;
  offers: OfferSummary[];
  bets: BetRow[];
  casinoSettlements?: { time: number; amount: number }[];
  pnlAdjustments?: { time: number; amount: number }[];
  showSideSummaries?: boolean;
  hasLiveEvent?: boolean;
  chart?: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  const [paceOpen, setPaceOpen] = useState(false);
  const [paceTab, setPaceTab] = useState<"daily" | "yearly">("daily");

  const paceIncome = useMemo((): PaceIncomePoint[] => {
    const points: PaceIncomePoint[] = [];
    for (const c of casinoSettlements) points.push({ time: c.time, amount: c.amount });
    for (const a of pnlAdjustments) points.push({ time: a.time, amount: a.amount });
    return points;
  }, [casinoSettlements, pnlAdjustments]);

  const pace = useMemo(() => computePaceStats(bets, paceIncome), [bets, paceIncome]);

  const openPace = (tab: "daily" | "yearly") => {
    setPaceTab(tab);
    setPaceOpen(true);
  };

  const pnlSub =
    Math.abs(provisional) >= 0.005 ? (
      <>
        Settled <MoneyFlow value={settled} signColor className="inline text-xs" />
        {" · "}
        Prov <MoneyFlow value={provisional} signColor signDisplay className="inline text-xs" />
      </>
    ) : openBets === 0 ? (
      "All settled - no open positions"
    ) : (
      `${openBets} open · worst-case counted in Profit`
    );

  const withChart = chart != null;

  return (
    // With the chart, fill the deck card so the plot takes leftover height.
    // No overflow-hidden here - it would break the sticky Summary header.
    <div
      className={cn(
        "flex min-h-0 flex-col border-b border-border/60",
        withChart ? "h-full" : "shrink-0 sm:block sm:min-h-0"
      )}
    >
      <DashboardSectionHeader
        prominent
        className="bg-page"
        title="Summary"
        description={
          withChart
            ? "Profit, pace, campaigns and the P&L chart."
            : "Profit, pace and campaign totals."
        }
        icon={hasLiveEvent ? Radio : undefined}
        iconClassName={
          hasLiveEvent
            ? "animate-pulse text-profit motion-reduce:animate-none"
            : undefined
        }
        action={headerAction}
      />
      <div
        className={cn(
          "flex flex-none flex-col justify-start gap-[var(--layout-section-y)] sm:flex-none sm:justify-start lg:flex-row lg:items-stretch lg:justify-between",
          overviewInset,
          withChart && "pb-3"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1",
            withChart && pace.dayCount > 0
              ? "flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-1.5 lg:gap-2"
              : "flex-col gap-10 sm:flex-row sm:items-stretch sm:gap-1.5 lg:gap-2"
          )}
        >
          <OverviewMetric
            label="Profit"
            value={<MoneyFlow value={liveTotal} signColor className="inline" />}
            sub={pnlSub}
            href={openBets > 0 && Math.abs(provisional) < 0.005 ? "/tracker" : undefined}
            compact={withChart}
            className={cn("sm:max-w-[13rem]", !withChart && "pt-1.5")}
          />
          {pace.dayCount > 0 ? (
            <div
              className={cn(
                withChart
                  ? "flex min-w-0 flex-row items-stretch gap-3 sm:contents"
                  : "contents"
              )}
            >
              <OverviewMetric
                label="Daily avg."
                value={<MoneyFlow value={pace.dailyAvg} className="inline" />}
                sub={`Since ${formatActivitySince(pace.activityStartMs)} · ${formatPaceDayCount(pace.dayCount)}`}
                onClick={() => openPace("daily")}
                muted
                compact={withChart}
                className={cn("sm:max-w-[13rem]", !withChart && "pt-1.5")}
              />
              <OverviewMetric
                label="Yearly est."
                value={<MoneyFlow value={pace.yearlyEst} className="inline" />}
                sub="Daily avg. × 365"
                onClick={() => openPace("yearly")}
                muted
                compact={withChart}
                className={cn("sm:max-w-[13rem]", !withChart && "pt-1.5")}
              />
            </div>
          ) : null}
        </div>

        {showSideSummaries ? (
          <div
            className={cn(
              "flex items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
              withChart ? "flex-row flex-wrap" : "flex-col"
            )}
          >
            <DashboardPnlSummaries offers={offers} bets={bets} />
          </div>
        ) : null}
      </div>

      {withChart ? (
        <div className={cn("flex flex-1 flex-col border-t border-border/60", homeDeckChartMinH)}>
          {chart}
        </div>
      ) : null}

      {pace.dayCount > 0 ? (
        <Dialog open={paceOpen} onOpenChange={setPaceOpen}>
          <DialogContent className="flex max-h-[min(36rem,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
              <DialogHeader className="mx-0 mt-0 shrink-0">
                <DialogTitle>Pace</DialogTitle>
                <DialogDescription>
                  Settled profit averaged since your first settlement.
                </DialogDescription>
              </DialogHeader>

            <ScrollFadeEdges
              className="min-h-0 flex-1"
              fadeClassName="from-page dark:from-card"
              scrollClassName="px-[var(--layout-card-x)] py-[var(--layout-card-x)]"
            >
              <Tabs
                value={paceTab}
                onValueChange={(v) => setPaceTab(v as "daily" | "yearly")}
                activationMode="manual"
                className="gap-3"
              >
                <TabsList variant="segmented" className="w-full">
                  <TabsTrigger value="daily">
                    Daily avg.
                    <MoneyFlow
                      value={pace.dailyAvg}
                      signColor
                      className="ml-1 inline text-xs font-semibold"
                    />
                  </TabsTrigger>
                  <TabsTrigger value="yearly">
                    Yearly est.
                    <MoneyFlow
                      value={pace.yearlyEst}
                      signColor
                      className="ml-1 inline text-xs font-semibold"
                    />
                  </TabsTrigger>
                </TabsList>

                {/* Stack both panels so height stays at the taller view (no dialog jump). */}
                <div className="grid">
                  <div
                    role="tabpanel"
                    aria-hidden={paceTab !== "daily"}
                    className={cn(
                      "col-start-1 row-start-1 space-y-3 outline-none",
                      paceTab !== "daily" && "invisible pointer-events-none"
                    )}
                  >
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Daily average
                      </p>
                      <div className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight">
                        <MoneyFlow value={pace.dailyAvg} signColor className="inline" />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Total settled ÷ {formatPaceDayCount(pace.dayCount)} since{" "}
                        {formatActivitySince(pace.activityStartMs)}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs dark:bg-input/20">
                      <div>
                        <dt className="text-muted-foreground">Settled P&L</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">
                          <MoneyFlow value={pace.totalProfit} signColor className="inline" />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Settlements</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">
                          {pace.settlementCount.toLocaleString("en-GB")}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-muted-foreground">Activity window</dt>
                        <dd className="mt-0.5 font-medium">
                          {formatActivitySince(pace.activityStartMs)} → today ·{" "}
                          {formatPaceDayCount(pace.dayCount)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div
                    role="tabpanel"
                    aria-hidden={paceTab !== "yearly"}
                    className={cn(
                      "col-start-1 row-start-1 space-y-3 outline-none",
                      paceTab !== "yearly" && "invisible pointer-events-none"
                    )}
                  >
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Yearly estimate
                      </p>
                      <div className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight">
                        <MoneyFlow value={pace.yearlyEst} signColor className="inline" />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Daily avg. × 365 - projects current pace over a full year
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-xs dark:bg-input/20">
                      <div>
                        <dt className="text-muted-foreground">Daily avg.</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">
                          <MoneyFlow value={pace.dailyAvg} signColor className="inline" />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Multiplier</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">× 365</dd>
                      </div>
                      <div className="col-span-2 flex items-start gap-2 text-xs text-muted-foreground">
                        <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Based on {formatPaceDayCount(pace.dayCount)} of settled activity. Short
                          windows can swing this estimate a lot.
                        </span>
                      </div>
                    </dl>
                  </div>
                </div>
              </Tabs>
            </ScrollFadeEdges>

            <div className="shrink-0 border-t bg-selection-subtle/50 px-[var(--layout-card-x)] py-[var(--layout-card-x)]">
              <Button variant="outline" className="h-10 w-full" asChild>
                <Link href="/tracker?tab=pnl">Full breakdown in tracker</Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
