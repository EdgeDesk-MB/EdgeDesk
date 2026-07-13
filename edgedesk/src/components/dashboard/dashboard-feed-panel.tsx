"use client";

/**
 * Home Feed panel - goals, results and settlements in real time.
 * Shared by the desktop dashboard grid and the mobile swipe deck; it must not
 * know which container it is in.
 */

import { useMemo, useState } from "react";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { HistoryFeed } from "@/components/history/history-feed";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import type { AppState } from "@/lib/services/state.types";
import { buildHistoryContext } from "@/lib/history-display";
import { dashboardPanelBody, dashboardSection } from "@/lib/ui/dashboard-layout";
import { cardInsetX } from "@/lib/ui/layout-spacing";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

type FeedFilter = "all" | "bets";

export function DashboardFeedPanel({
  state,
  className,
}: {
  state: AppState | null;
  className?: string;
}) {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");

  const historyContext = useMemo(
    () =>
      state
        ? buildHistoryContext(state.events, state.bets, state.promoAwards)
        : buildHistoryContext([], [], {}),
    [state]
  );

  return (
    <section className={cn(dashboardSection, "min-h-0 flex-1", className)}>
      <DashboardSectionHeader
        prominent
        titleHref="/history"
        title="Feed"
        description="Goals, results and settlements in real time."
      />
      <div className={cn("shrink-0 border-b border-border/60", cardInsetX)}>
        <div className="flex justify-end gap-1 py-2">
          <button
            type="button"
            className={cn(
              filterPillState(feedFilter === "bets"),
              "shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] leading-none"
            )}
            onClick={() => setFeedFilter("bets")}
          >
            Bets only
          </button>
          <button
            type="button"
            className={cn(
              filterPillState(feedFilter === "all"),
              "shrink-0 whitespace-nowrap px-2.5 py-1 text-[11px] leading-none"
            )}
            onClick={() => setFeedFilter("all")}
          >
            All
          </button>
        </div>
      </div>
      <ScrollFadeEdges
        scrollClassName={cn(
          dashboardPanelBody,
          "app-scroll-overlay px-[var(--layout-card-x)] pb-3 pt-0"
        )}
      >
        <HistoryFeed
          entries={
            feedFilter === "bets"
              ? (state?.history ?? []).filter((e) => e.kind === "settlement")
              : (state?.history ?? [])
          }
          ctx={historyContext}
          compact
        />
      </ScrollFadeEdges>
    </section>
  );
}
