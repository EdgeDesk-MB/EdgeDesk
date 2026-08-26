"use client";

/**
 * Home Feed panel - goals, results and settlements in real time.
 * Shared by the desktop dashboard grid and the mobile swipe deck; it must not
 * know which container it is in.
 *
 * "All" / "Bets" use the polled state.history slice (latest ~40). "Casino"
 * fetches a dedicated filtered history so older casino settlements are not
 * dropped just because denser match commentary filled the All window.
 */

import { useEffect, useMemo, useState } from "react";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { DashboardLiveTabs } from "@/components/dashboard/dashboard-live-tabs";
import { HistoryFeed } from "@/components/history/history-feed";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { apiGet, useAppState } from "@/hooks/use-app-state";
import type { AppState } from "@/lib/services/state.types";
import { buildHistoryContext } from "@/lib/history-display";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import { dashboardPanelBody, dashboardSection } from "@/lib/ui/dashboard-layout";
import { FilterPill } from "@/components/ui/filter-pill";
import { cn } from "@/lib/utils";

type FeedFilter = "all" | "bets" | "casino";

const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "bets", label: "Bets" },
  { id: "casino", label: "Casino" },
  { id: "all", label: "All" },
];

interface CasinoHistoryPayload {
  entries: HistoryRow[];
  events: EventRow[];
  bets: BetRow[];
  promoAwards: Record<number, { amount: number; reason: string }>;
  offerTitles?: Array<{ id: number; title: string }>;
}

export function DashboardFeedPanel({
  state,
  className,
  /** When true, docks Live under the feed so growth steals History space, not the chart. */
  showLiveDock = false,
}: {
  state: AppState | null;
  className?: string;
  showLiveDock?: boolean;
}) {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [casinoFeed, setCasinoFeed] = useState<CasinoHistoryPayload | null>(null);
  const { refresh } = useAppState(10_000);

  useEffect(() => {
    if (feedFilter !== "casino") {
      setCasinoFeed(null);
      return;
    }
    let live = true;
    // Dedicated fetch: state.history is capped at ~40 across ALL kinds, so an
    // older casino row can fall out of the Home All window while History still
    // shows it under the Casino filter.
    apiGet<CasinoHistoryPayload>("/api/history?filter=casino&limit=40")
      .then((res) => {
        if (live) setCasinoFeed(res);
      })
      .catch(() => {
        if (live) setCasinoFeed(null);
      });
    return () => {
      live = false;
    };
  }, [feedFilter, state?.history]);

  const historyContext = useMemo(() => {
    if (feedFilter === "casino" && casinoFeed) {
      return buildHistoryContext(
        casinoFeed.events,
        casinoFeed.bets,
        casinoFeed.promoAwards,
        casinoFeed.offerTitles ?? [],
        casinoFeed.entries
      );
    }
    return state
      ? buildHistoryContext(
          state.events,
          state.bets,
          state.promoAwards,
          (state.offers ?? []).map((o) => ({ id: o.id, title: o.title })),
          state.history
        )
      : buildHistoryContext([], [], {});
  }, [feedFilter, casinoFeed, state]);

  const feedEntries = useMemo(() => {
    if (feedFilter === "casino") return casinoFeed?.entries ?? [];
    const rows = state?.history ?? [];
    if (feedFilter === "bets") return rows.filter((e) => e.kind === "settlement");
    return rows;
  }, [feedFilter, casinoFeed?.entries, state?.history]);

  return (
    <section className={cn(dashboardSection, "min-h-0 flex-1", className)}>
      <DashboardSectionHeader
        prominent
        className="bg-page"
        titleHref="/history"
        title="History feed"
        description="Goals, results, bet and casino settlements in real time."
        action={
          <ScrollFadeEdges
            orientation="horizontal"
            className="min-w-0 w-full flex-none"
            fadeClassName="from-page"
            scrollClassName="flex justify-end gap-1"
          >
            {FEED_FILTERS.map((f) => (
              <FilterPill
                key={f.id}
                compact
                active={feedFilter === f.id}
                onClick={() => setFeedFilter(f.id)}
                className="shrink-0 whitespace-nowrap"
              >
                {f.label}
              </FilterPill>
            ))}
          </ScrollFadeEdges>
        }
      />
      <ScrollFadeEdges
        className="min-h-0 flex-1"
        scrollClassName={cn(
          dashboardPanelBody,
          "app-scroll-overlay px-[var(--layout-card-x)] pb-3 pt-0"
        )}
      >
        <HistoryFeed
          entries={feedEntries}
          ctx={historyContext}
          compact
          onFreeBetAwarded={() => void refresh()}
          onNoteSaved={() => void refresh()}
        />
      </ScrollFadeEdges>
      {showLiveDock && state ? (
        <DashboardLiveTabs
          state={state}
          docked
          className="border-t border-border/60"
        />
      ) : null}
    </section>
  );
}
