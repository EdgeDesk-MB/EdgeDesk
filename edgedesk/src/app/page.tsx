"use client";

import { useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { LivePnlChart } from "@/components/dashboard/live-pnl-chart";
import { DashboardLiveTabs } from "@/components/dashboard/dashboard-live-tabs";
import { DashboardOverviewBar } from "@/components/dashboard/dashboard-overview-bar";
import { DashboardDoNext } from "@/components/dashboard/dashboard-do-next";
import { DailyPlan } from "@/components/dashboard/daily-plan";
import { DashboardFeedPanel } from "@/components/dashboard/dashboard-feed-panel";
import { MobileHomeDeck } from "@/components/dashboard/mobile-home-deck";
import { NakedExposureBanner } from "@/components/naked-exposure-banner";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { effectiveEventStatus } from "@/lib/events";
import { listOfferNextActions } from "@/lib/offers/next-actions";
import {
  dashboardMainGrid,
  dashboardPage,
  dashboardPanelColumn,
} from "@/lib/ui/dashboard-layout";
import { DEFAULT_HOME_LAYOUT, applyDeckLayout } from "@/lib/ui/home-layout";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { state } = useAppState();
  // null on first paint (CSS classes handle visibility); afterwards only one
  // container stays mounted so hidden copies don't poll or drift local state.
  const isMobile = useIsMobile();

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

  const offers = state?.offers ?? [];
  const nextActions = useMemo(() => listOfferNextActions(offers), [offers]);
  const showEmptyCta =
    openBets.length === 0 && betCount === 0 && nextActions.length === 0;
  const showActivity = betCount > 0 || liveEvents.length > 0 || Math.abs(liveTotal) > 0.01;

  const planSignals =
    (state?.planRaces?.length ?? 0) + (state?.planFixtures?.length ?? 0) + nextActions.length;

  const overviewBar = (
    <DashboardOverviewBar
      liveTotal={liveTotal}
      settled={settled}
      provisional={provisional}
      openBets={openBets.length}
      offers={offers}
      bets={state?.bets ?? []}
    />
  );

  const pnlChart = (
    <LivePnlChart
      liveTotal={liveTotal}
      historicSeries={state?.series ?? []}
      bets={state?.bets ?? []}
      adjustments={state?.pnlAdjustments ?? []}
      liveInPlay={showLive}
      hasLiveEvent={liveEvents.length > 0}
      panel
      className="min-h-0 flex-1"
    />
  );

  const homeLayout = state?.settings.homeLayout ?? DEFAULT_HOME_LAYOUT;
  const desktopHidden = new Set<string>(homeLayout.desktopHidden);

  // Data-driven conditionals first (no plan signals = no plan card), then the
  // user's order and hidden set (E2).
  const deckCards = applyDeckLayout(
    [
      { id: "hero", label: "Overview", node: overviewBar },
      ...(planSignals > 0 ? [{ id: "plan", label: "Today's plan", node: <DailyPlan /> }] : []),
      { id: "chart", label: "Chart", node: pnlChart },
      { id: "feed", label: "Feed", node: <DashboardFeedPanel state={state} /> },
      ...(nextActions.length > 0
        ? [{ id: "do-next", label: "Do next", node: <DashboardDoNext /> }]
        : []),
    ],
    homeLayout
  );

  const showChartPanel = showActivity && !desktopHidden.has("chart");
  const showPlanPanel = !desktopHidden.has("plan");
  const showFeedPanel = !desktopHidden.has("feed");

  return (
    <PageShell fullHeight>
      <div className={dashboardPage}>
        <NakedExposureBanner />

        {isMobile !== true ? (
          <>
            {!desktopHidden.has("hero") ? (
              <div className="hidden sm:contents">{overviewBar}</div>
            ) : null}
            {!desktopHidden.has("do-next") ? (
              <DashboardDoNext className="hidden sm:block" />
            ) : null}
          </>
        ) : null}

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
            {state && isMobile === true ? (
              <MobileHomeDeck
                cards={deckCards}
                pin={state.settings.mobileDeckPin}
                hasOpenPositions={livePositionCount > 0}
                hasPlanWork={planSignals > 0}
                className="sm:hidden"
              />
            ) : null}

            {isMobile !== true ? (
              <>
                {showChartPanel || showPlanPanel || showFeedPanel ? (
                  <div
                    className={cn(
                      dashboardMainGrid,
                      "hidden border-t border-border/60 sm:grid lg:grid-cols-2 xl:grid-cols-12"
                    )}
                  >
                    {showChartPanel && (
                      <div
                        className={cn(
                          dashboardPanelColumn,
                          showPlanPanel || showFeedPanel
                            ? "xl:col-span-6"
                            : "lg:col-span-2 xl:col-span-12"
                        )}
                      >
                        {pnlChart}
                      </div>
                    )}

                    {showPlanPanel || showFeedPanel ? (
                      <div
                        className={cn(
                          dashboardPanelColumn,
                          showChartPanel
                            ? "border-t border-border/60 lg:col-span-1 lg:border-t-0 xl:col-span-6"
                            : "lg:col-span-2 xl:col-span-12"
                        )}
                      >
                        {showPlanPanel ? (
                          <DailyPlan
                            className={showFeedPanel ? "border-b border-border/60" : undefined}
                          />
                        ) : null}
                        {showFeedPanel ? <DashboardFeedPanel state={state} /> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showLive && (
                  <div className="hidden border-t border-border/60 sm:block">
                    <DashboardLiveTabs state={state} />
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </PageShell>
  );
}
