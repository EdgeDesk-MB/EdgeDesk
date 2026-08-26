"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { PageShell } from "@/components/page-shell";
import {
  DEFAULT_CHART_WINDOW,
  LivePnlChart,
  PnlChartWindowPills,
} from "@/components/dashboard/live-pnl-chart";
import { DashboardLiveTabs } from "@/components/dashboard/dashboard-live-tabs";
import { DashboardOverviewBar } from "@/components/dashboard/dashboard-overview-bar";
import { DashboardDoNext } from "@/components/dashboard/dashboard-do-next";
import { DailyPlan } from "@/components/dashboard/daily-plan";
import { DashboardFeedPanel } from "@/components/dashboard/dashboard-feed-panel";
import { MobileHomeDeck } from "@/components/dashboard/mobile-home-deck";
import { NakedExposureBanner } from "@/components/naked-exposure-banner";
import { EmptyDeskWelcome } from "@/components/dashboard/empty-desk-welcome";
import { useAppState } from "@/hooks/use-app-state";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { effectiveEventStatus } from "@/lib/events";
import { listOfferNextActions } from "@/lib/offers/next-actions";
import {
  shouldShowDashboardEmptyCta,
  shouldShowEmptyDeskWelcome,
} from "@/lib/dashboard-empty";
import { EmptyState } from "@/components/help/empty-state";
import {
  dashboardMainGrid,
  dashboardPage,
  dashboardPanelColumn,
} from "@/lib/ui/dashboard-layout";
import {
  DEFAULT_HOME_LAYOUT,
  applyDeckLayout,
  isChartOnMobileSummary,
} from "@/lib/ui/home-layout";
import { cn } from "@/lib/utils";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { canDesk } from "@/lib/entitlements/effective-plan";

function MobileHomeSummary({
  overview,
  chartProps,
  showChart,
}: {
  overview: ComponentProps<typeof DashboardOverviewBar>;
  chartProps: ComponentProps<typeof LivePnlChart>;
  showChart: boolean;
}) {
  const [windowSecs, setWindowSecs] = useState(DEFAULT_CHART_WINDOW);
  return (
    <DashboardOverviewBar
      {...overview}
      headerAction={
        showChart ? (
          <PnlChartWindowPills value={windowSecs} onChange={setWindowSecs} />
        ) : undefined
      }
      chart={
        showChart ? (
          <LivePnlChart
            {...chartProps}
            embed
            windowSecs={windowSecs}
            onWindowChange={setWindowSecs}
          />
        ) : undefined
      }
    />
  );
}

export default function DashboardPage() {
  const { state } = useAppState();
  // null on first paint (CSS classes handle visibility); afterwards only one
  // container stays mounted so hidden copies don't poll or drift local state.
  const isMobile = useIsMobile();

  const liveEvents = useMemo(
    () => (state?.events ?? []).filter((e) => effectiveEventStatus(e) === "live"),
    [state]
  );
  const openBets = useMemo(() => (state?.bets ?? []).filter((b) => b.status === "open"), [state]);
  const offers = state?.offers ?? [];
  const nextActions = useMemo(() => listOfferNextActions(offers), [offers]);

  // Wait for /api/state so profit never paints as £0.00 before real figures land.
  if (state == null) {
    return (
      <PageShell fullHeight>
        <div
          className={cn(dashboardPage, "items-center justify-center")}
          role="status"
          aria-live="polite"
          aria-label="Loading desk"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </PageShell>
    );
  }

  const settled = state.settledProfit;
  const provisional = state.provisionalProfit;
  const liveTotal = settled + provisional;
  const betCount = state.bets.length;
  const livePositionCount = state.livePositions.length;
  const showLive = liveEvents.length > 0 || livePositionCount > 0;
  const showEmptyCta = shouldShowDashboardEmptyCta(state);
  // Series already folds bets + casino + adjustments; include it so a
  // casino-only desk still shows the chart (even at ~£0 live total).
  const showActivity =
    betCount > 0 ||
    liveEvents.length > 0 ||
    Math.abs(liveTotal) > 0.01 ||
    state.series.length > 0;

  const canDoNext = canDesk(state.settings, "do_next");
  const planSignals = canDoNext
    ? state.planRaces.length + state.planFixtures.length + nextActions.length
    : 0;

  const homeLayout = state.settings.homeLayout ?? DEFAULT_HOME_LAYOUT;
  const desktopHidden = new Set<string>(homeLayout.desktopHidden);
  const showMobileChart = showActivity && isChartOnMobileSummary(homeLayout);

  const chartProps = {
    liveTotal,
    historicSeries: state.series,
    bets: state.bets,
    adjustments: state.pnlAdjustments,
    casinoSettlements: state.casinoSettlements,
    liveInPlay: showLive,
    hasLiveEvent: liveEvents.length > 0,
    panel: true as const,
    className: "min-h-0 flex-1",
  };

  const pnlChart = <LivePnlChart {...chartProps} />;

  const overviewProps = {
    liveTotal,
    settled,
    provisional,
    openBets: openBets.length,
    offers,
    bets: state.bets,
    casinoSettlements: state.casinoSettlements,
    pnlAdjustments: state.pnlAdjustments,
    hasLiveEvent: liveEvents.length > 0,
  };

  const overviewDesktop = <DashboardOverviewBar {...overviewProps} />;
  const overviewMobile = (
    <MobileHomeSummary
      overview={overviewProps}
      chartProps={chartProps}
      showChart={showMobileChart}
    />
  );

  // Plan stays mounted so an empty day keeps the header and a plated empty.
  // Then the user's order and hidden set (E2). Chart is not a standalone card.
  const deckCards = applyDeckLayout(
    [
      { id: "hero", label: "Summary", node: overviewMobile },
      ...(canDoNext
        ? [{ id: "plan", label: "Today's plan", node: <DailyPlan keepMounted /> }]
        : []),
      { id: "feed", label: "History feed", node: <DashboardFeedPanel state={state} /> },
      ...(canDoNext && nextActions.length > 0
        ? [{ id: "do-next", label: "Do next", node: <DashboardDoNext /> }]
        : []),
    ],
    homeLayout
  );

  const showChartPanel = showActivity && !desktopHidden.has("chart");
  const showPlanPanel = canDoNext && planSignals > 0 && !desktopHidden.has("plan");
  const showFeedPanel = !desktopHidden.has("feed");

  if (showEmptyCta) {
    return (
      <PageShell>
        <NakedExposureBanner />
        {shouldShowEmptyDeskWelcome(state) ? (
          <EmptyDeskWelcome />
        ) : (
          <EmptyState
            icon={SlidersHorizontal}
            title="Set up the desk"
            description="Add your bank and bookies first. Then you can import history or log a ticket."
            action={{ label: "Set up the desk", href: "/setup" }}
          />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell fullHeight>
      <div className={dashboardPage}>
        <NakedExposureBanner />

        {isMobile !== true ? (
          <>
            {!desktopHidden.has("hero") ? (
              <div className="hidden sm:contents">{overviewDesktop}</div>
            ) : null}
            {canDoNext && !desktopHidden.has("do-next") ? (
              <DashboardDoNext className="hidden sm:block" />
            ) : null}
          </>
        ) : null}

        <>
            {isMobile !== false ? (
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
                            className={
                              showFeedPanel || showLive
                                ? "border-b border-border/60"
                                : undefined
                            }
                          />
                        ) : null}
                        {showFeedPanel ? (
                          <DashboardFeedPanel
                            state={state}
                            showLiveDock={showLive}
                          />
                        ) : showLive ? (
                          <DashboardLiveTabs
                            state={state}
                            docked
                            className="min-h-0 flex-1"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* No History / plan column: keep Live on the page foot. */}
                {showLive && !showFeedPanel && !showPlanPanel ? (
                  <div className="hidden border-t border-border/60 sm:block">
                    <DashboardLiveTabs state={state} docked />
                  </div>
                ) : null}
              </>
            ) : null}
        </>
      </div>
    </PageShell>
  );
}
