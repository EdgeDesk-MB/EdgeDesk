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
  applyDeckLayout,
  ensureVisibleDeckCards,
  isChartOnMobileSummary,
  normalizeHomeLayout,
} from "@/lib/ui/home-layout";
import { PageLoading } from "@/components/page-loading";
import { cn } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";
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
  const { state, error, refresh } = useAppState();
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
    if (error) {
      return (
        <PageShell>
          <EmptyState
            title="Could not load the desk"
            description="Check the connection, then try again."
            action={{ label: "Try again", onClick: () => void refresh() }}
          />
        </PageShell>
      );
    }
    return <PageLoading label="Loading Desk" />;
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

  const homeLayout = normalizeHomeLayout(state.settings.homeLayout);
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

  // User's order and hidden set (E2). Chart is not a standalone card.
  // If every swipe card is hidden or Do next has no work, keep Summary so
  // the phone Home is never blank.
  const overviewCard = { id: "hero", label: "Summary", node: overviewMobile };
  const deckCards = ensureVisibleDeckCards(
    applyDeckLayout(
      [
        overviewCard,
        { id: "feed", label: "Live feed", node: <DashboardFeedPanel state={state} /> },
        ...(canDoNext && nextActions.length > 0
          ? [{ id: "do-next", label: "Do next", node: <DashboardDoNext /> }]
          : []),
      ],
      homeLayout
    ),
    overviewCard
  );

  const showChartPanel = showActivity && !desktopHidden.has("chart");
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
                className="sm:hidden"
              />
            ) : null}

            {isMobile !== true ? (
              <>
                {showChartPanel || showFeedPanel ? (
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
                          showFeedPanel
                            ? "xl:col-span-6"
                            : "lg:col-span-2 xl:col-span-12"
                        )}
                      >
                        {pnlChart}
                      </div>
                    )}

                    {showFeedPanel ? (
                      <div
                        className={cn(
                          dashboardPanelColumn,
                          showChartPanel
                            ? "border-t border-border/60 lg:col-span-1 lg:border-t-0 xl:col-span-6"
                            : "lg:col-span-2 xl:col-span-12"
                        )}
                      >
                        <DashboardFeedPanel
                          state={state}
                          showLiveDock={showLive}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {showLive && !showFeedPanel ? (
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
