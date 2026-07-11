"use client";

import { useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { LivePnlChart } from "@/components/dashboard/live-pnl-chart";
import { DashboardLiveTabs } from "@/components/dashboard/dashboard-live-tabs";
import { DashboardOverviewBar } from "@/components/dashboard/dashboard-overview-bar";
import { DashboardDoNext } from "@/components/dashboard/dashboard-do-next";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import { effectiveEventStatus } from "@/lib/events";
import { HistoryFeed } from "@/components/history/history-feed";
import { buildHistoryContext } from "@/lib/history-display";
import { listOfferNextActions } from "@/lib/offers/next-actions";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  dashboardMainGrid,
  dashboardPage,
  dashboardPanelBody,
  dashboardPanelColumn,
  dashboardSection,
} from "@/lib/ui/dashboard-layout";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

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

  const offers = state?.offers ?? [];
  const nextActions = useMemo(() => listOfferNextActions(offers), [offers]);
  const showEmptyCta =
    openBets.length === 0 && betCount === 0 && nextActions.length === 0;
  const showActivity = betCount > 0 || liveEvents.length > 0 || Math.abs(liveTotal) > 0.01;

  return (
    <PageShell fullHeight>
      <div className={dashboardPage}>
        <DashboardOverviewBar
          liveTotal={liveTotal}
          settled={settled}
          provisional={provisional}
          openBets={openBets.length}
          offers={offers}
          bets={state?.bets ?? []}
        />

        <DashboardDoNext />

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
          <>
            <div
              className={cn(
                dashboardMainGrid,
                "border-t border-border/60 lg:grid-cols-2 xl:grid-cols-12"
              )}
            >
              {showActivity && (
                <div className={cn(dashboardPanelColumn, "xl:col-span-6")}>
                  <LivePnlChart
                    liveTotal={liveTotal}
                    historicSeries={state?.series ?? []}
                    bets={state?.bets ?? []}
                    liveInPlay={showLive}
                    hasLiveEvent={liveEvents.length > 0}
                    panel
                    className="min-h-0 flex-1"
                  />
                </div>
              )}

              <div
                className={cn(
                  dashboardPanelColumn,
                  showActivity
                    ? "border-t border-border/60 lg:col-span-1 lg:border-t-0 xl:col-span-6"
                    : "lg:col-span-2 xl:col-span-12"
                )}
              >
                <section className={cn(dashboardSection, "min-h-0 flex-1")}>
                  <DashboardSectionHeader
                    prominent
                    titleHref="/history"
                    title="Feed"
                    description="Goals, results and settlements in real time."
                  />
                  <ScrollFadeEdges
                    scrollClassName={cn(
                      dashboardPanelBody,
                      "app-scroll-overlay px-[var(--layout-card-x)] pb-3 pt-0"
                    )}
                  >
                    <HistoryFeed entries={state?.history ?? []} ctx={historyContext} compact />
                  </ScrollFadeEdges>
                </section>
              </div>
            </div>

            {showLive && (
              <div className="border-t border-border/60">
                <DashboardLiveTabs state={state} />
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
