"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HistoryEntryCard,
  useHistoryMatchTape,
} from "@/components/history/history-feed";
import { HistoryListSkeleton } from "@/components/history/history-list-skeleton";
import {
  HistoryPageHeader,
  type HistoryViewDensity,
} from "@/components/history/history-page-header";
import { PageFillScroll, PageFillShell } from "@/components/page-shell";
import { EmptyState } from "@/components/help/empty-state";
import { api, apiGet } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import { groupHistoryFeedByDay, type HistoryFilter } from "@/lib/history-display";
import {
  appendHistoryPage,
  HISTORY_PAGE_MAX,
  HISTORY_PAGE_SIZE,
  historyContextFromPage,
  historyPageApiPath,
  refreshHistoryHead,
  type HistoryPagePayload,
} from "@/lib/history-page";
import { ListDaySection } from "@/components/layout/list-day-section";
import { listDaySectionContentCompact } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { History as HistoryIcon, Loader2 } from "lucide-react";

const HISTORY_VIEW_STORAGE_KEY = "edgeways:history-view-density";

/** Start the next page this far before the end of the list scrolls into view. */
const LOAD_AHEAD_MARGIN = "800px 0px";

const EMPTY_CONTEXT = historyContextFromPage({
  events: [],
  bets: [],
  promoAwards: {},
  offerTitles: [],
  goalSides: [],
  twoUpTriggers: [],
});

function readStoredViewDensity(): HistoryViewDensity {
  try {
    const raw = localStorage.getItem(HISTORY_VIEW_STORAGE_KEY);
    return raw === "collapsed" ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

function storeViewDensity(density: HistoryViewDensity) {
  try {
    localStorage.setItem(HISTORY_VIEW_STORAGE_KEY, density);
  } catch {
    // ignore
  }
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  // Loaded after mount: reading localStorage during the first render would
  // disagree with the server HTML and break hydration.
  const [viewDensity, setViewDensity] = useState<HistoryViewDensity>("expanded");
  const [data, setData] = useState<HistoryPagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  /** Bumps per filter so a late page for the old filter is dropped. */
  const generation = useRef(0);
  const loadingMoreRef = useRef(false);
  const listTopRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const collapsed = viewDensity === "collapsed";

  useEffect(() => {
    queueMicrotask(() => setViewDensity(readStoredViewDensity()));
  }, []);

  function changeViewDensity(next: HistoryViewDensity) {
    setViewDensity(next);
    storeViewDensity(next);
  }

  /** Loading flips in the event handler; the effect only does async work. */
  function changeFilter(next: HistoryFilter) {
    if (next === filter) return;
    setFilter(next);
    setData(null);
    setLoading(true);
    setLoadFailed(false);
    setLoadingMore(false);
    setLoadMoreFailed(false);
    loadingMoreRef.current = false;
    listTopRef.current?.closest(".app-scroll-nested")?.scrollTo({ top: 0 });
  }

  function retryFirstPage() {
    setLoadFailed(false);
    setLoading(true);
    setRetryToken((n) => n + 1);
  }

  useEffect(() => {
    const gen = ++generation.current;
    apiGet<HistoryPagePayload>(historyPageApiPath(filter))
      .then((res) => {
        if (gen !== generation.current) return;
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        if (gen !== generation.current) return;
        setLoadFailed(true);
        setLoading(false);
      });
  }, [filter, retryToken]);

  const nextCursor = data?.nextCursor ?? null;

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMoreRef.current) return;
    const gen = generation.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    api<HistoryPagePayload>(historyPageApiPath(filter, { cursor: nextCursor }))
      .then((next) => {
        if (gen !== generation.current) return;
        setData((prev) => (prev ? appendHistoryPage(prev, next) : next));
      })
      .catch(() => {
        if (gen === generation.current) setLoadMoreFailed(true);
      })
      .finally(() => {
        if (gen !== generation.current) return;
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [filter, nextCursor]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !nextCursor || loadMoreFailed) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((item) => item.isIntersecting)) loadMore();
      },
      { rootMargin: LOAD_AHEAD_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadMore, loadMoreFailed]);

  /** Re-read what is on screen after an edit, without dropping loaded pages. */
  const refreshLoaded = useCallback(() => {
    const gen = generation.current;
    const limit = Math.min(
      Math.max(data?.entries.length ?? 0, HISTORY_PAGE_SIZE),
      HISTORY_PAGE_MAX
    );
    void api<HistoryPagePayload>(historyPageApiPath(filter, { limit }))
      .then((res) => {
        if (gen !== generation.current) return;
        setData((prev) => (prev ? refreshHistoryHead(prev, res) : res));
      })
      .catch(() => {});
  }, [data?.entries.length, filter]);

  const ctx = useMemo(() => (data ? historyContextFromPage(data) : EMPTY_CONTEXT), [data]);

  const now = useNow(60_000);
  const { crests, crestsReady, onOpenMatch, dialog } = useHistoryMatchTape(
    data?.entries ?? [],
    ctx
  );

  // Plain derivation - the React Compiler memoizes this better than a manual
  // useMemo it cannot preserve. Rows arrive in feed order from the server.
  const grouped = data?.entries.length ? groupHistoryFeedByDay(data.entries, ctx, now) : [];

  return (
    <PageFillShell>
      <HistoryPageHeader
        filter={filter}
        onFilterChange={changeFilter}
        viewDensity={viewDensity}
        onViewDensityChange={changeViewDensity}
      />

      <PageFillScroll>
      <div ref={listTopRef} />
      {loading && !data ? <HistoryListSkeleton collapsed={collapsed} /> : null}

      {!loading && loadFailed && !data ? (
        <EmptyState
          icon={HistoryIcon}
          title="Could not load history"
          description="Check the connection, then try again."
          action={{ label: "Try again", onClick: retryFirstPage }}
        />
      ) : null}

      {!loading && !loadFailed && grouped.length === 0 && (
        <EmptyState
          icon={HistoryIcon}
          title="No history yet"
          description="Track a live event or log a bet, and settlements, goals and promo awards will appear here automatically."
          action={{ label: "Browse fixtures", href: "/fixtures" }}
          secondaryAction={{ label: "Open tracker", href: "/tracker" }}
        />
      )}

      <div className="flex flex-col gap-8">
        {grouped.map((group) => (
          <ListDaySection
            key={group.key}
            label={group.label}
            headingId={`history-day-${group.key}`}
            contentClassName={cn(listDaySectionContentCompact, collapsed && "gap-2")}
          >
            {group.entries.map((entry) => (
              <HistoryEntryCard
                key={entry.id}
                entry={entry}
                ctx={ctx}
                bet={entry.betId != null ? ctx.betsById.get(entry.betId) : undefined}
                collapsed={collapsed}
                crests={crests}
                crestsReady={crestsReady}
                onOpenMatch={onOpenMatch}
                onFreeBetAwarded={refreshLoaded}
                onNoteSaved={refreshLoaded}
              />
            ))}
          </ListDaySection>
        ))}
      </div>

      {nextCursor ? (
        <div ref={loadMoreRef} className="flex flex-col items-center gap-2 pt-6 pb-2">
          <p role="status" className="text-xs text-muted-foreground empty:hidden">
            {loadMoreFailed ? "Could not load more history." : null}
            {loadingMore ? <span className="sr-only">Loading more history</span> : null}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={loadMore}
            aria-disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
            ) : null}
            {loadingMore ? "Loading more" : loadMoreFailed ? "Try again" : "Load more"}
          </Button>
        </div>
      ) : grouped.length > 0 ? (
        <p className="pt-6 pb-2 text-center text-xs text-muted-foreground">
          Start of your history
        </p>
      ) : null}
      </PageFillScroll>
      {dialog}
    </PageFillShell>
  );
}
