"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { LivePnlChart } from "@/components/dashboard/live-pnl-chart";
import { DashboardLiveTabs } from "@/components/dashboard/dashboard-live-tabs";
import { DashboardOverviewBar } from "@/components/dashboard/dashboard-overview-bar";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import { effectiveEventStatus } from "@/lib/events";
import { HistoryFeed } from "@/components/history/history-feed";
import { buildHistoryContext } from "@/lib/history-display";
import {
  dashboardMainGrid,
  dashboardPage,
  dashboardPanelBody,
  dashboardPanelColumn,
  dashboardSection,
} from "@/lib/ui/dashboard-layout";
import { cn } from "@/lib/utils";
import { History as HistoryIcon, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { state } = useAppState();

  const settled = state?.settledProfit ?? 0;
  const provisional = state?.provisionalProfit ?? 0;
  const liveTotal = settled + provisional;

  const liveEvents = useMemo(
    () => (state?.events ?? []).filter((e) => effectiveEventStatus(e) === "live"),
    [state]
  );
  const openBets = useMemo(() => (state?.bets ?? []).filter((b) => b.status === "open"), [state]);
  const betCount = (state?.bets ?? []).length;
  const livePositionCount = state?.livePositions.length ?? 0;
  const showLive = liveEvents.length > 0 || livePositionCount > 0;

  const historyContext = useMemo(
    () =>
      state
        ? buildHistoryContext(state.events, state.bets, state.promoAwards)
        : buildHistoryContext([], [], {}),
    [state]
  );

  const showEmptyCta = openBets.length === 0 && betCount === 0;
  const showActivity = betCount > 0 || liveEvents.length > 0 || Math.abs(liveTotal) > 0.01;
  const offers = state?.offers ?? [];

  return (
    <PageShell fullHeight>
      <div className={dashboardPage}>
        <DashboardOverviewBar
          liveTotal={liveTotal}
          settled={settled}
          provisional={provisional}
          openBets={openBets.length}
          liveEventCount={liveEvents.length}
          offers={offers}
          bets={state?.bets ?? []}
        />

        {showEmptyCta ? (
          <EmptyState
            icon={TrendingUp}
            title="No positions yet"
            description="Try the 60-second demo loop: simulate a 2UP match, add a dutch bet, link it in the tracker, and watch this dashboard move as goals go in."
            action={{ label: "Start simulated match", href: "/tracked-events" }}
            secondaryAction={{ label: "Read getting started", href: "/help?guide=getting-started" }}
            className="mx-auto w-full max-w-lg flex-1 border-t border-border/60 px-[var(--layout-page-x)] py-8"
          />
        ) : (
          <div className={cn(dashboardMainGrid, "border-t border-border/60")}>
            {showActivity && (
              <div
                className={cn(
                  dashboardPanelColumn,
                  showLive ? "xl:col-span-5" : "xl:col-span-8"
                )}
              >
                <LivePnlChart
                  liveTotal={liveTotal}
                  historicSeries={state?.series ?? []}
                  panel
                  className="min-h-0 flex-1"
                />
              </div>
            )}

            {showLive && (
              <div
                className={cn(
                  dashboardPanelColumn,
                  showActivity
                    ? "border-t border-border/60 lg:order-3 lg:col-span-2 lg:border-t-0 xl:order-none xl:col-span-3"
                    : "lg:col-span-1 xl:col-span-4"
                )}
              >
                <DashboardLiveTabs state={state} className="min-h-0 flex-1" />
              </div>
            )}

            <div
              className={cn(
                dashboardPanelColumn,
                showActivity
                  ? "border-t border-border/60 lg:col-span-1 lg:border-t-0 xl:col-span-4"
                  : showLive
                    ? "lg:col-span-2 xl:col-span-8"
                    : "lg:col-span-2 xl:col-span-12"
              )}
            >
              <section className={cn(dashboardSection, "min-h-0 flex-1")}>
                <DashboardSectionHeader
                  icon={HistoryIcon}
                  title="History"
                  description="Goals, race results and settlements in real time."
                  action={
                    <Link
                      href="/history"
                      className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      View all →
                    </Link>
                  }
                />
                <ScrollFadeEdges scrollClassName={cn(dashboardPanelBody, "pb-3 pt-0")}>
                  <HistoryFeed entries={state?.history ?? []} ctx={historyContext} compact />
                </ScrollFadeEdges>
              </section>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
