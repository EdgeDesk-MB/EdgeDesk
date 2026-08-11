"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryEntryCard } from "@/components/history/history-feed";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { apiGet } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import {
  buildHistoryContext,
  formatHistoryDateGroup,
  HISTORY_FILTERS,
  type HistoryFilter,
} from "@/lib/history-display";
import { cn } from "@/lib/utils";
import { FilterPill } from "@/components/ui/filter-pill";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SportIcon } from "@/components/sport-icon";
import { Dices, History as HistoryIcon, LayoutList, Rows3, Zap } from "lucide-react";

export type HistoryViewDensity = "expanded" | "collapsed";

const HISTORY_VIEW_STORAGE_KEY = "edgeways:history-view-density";

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

function historyFilterIcon(id: HistoryFilter) {
  if (id === "match_events") return <SportIcon sport="football" size={12} />;
  if (id === "racing") return <SportIcon sport="horse_racing" size={12} />;
  if (id === "casino") return <Dices className="size-3" />;
  if (id === "boosts") return <Zap className="size-3" />;
  return null;
}

interface HistoryPayload {
  entries: HistoryRow[];
  events: EventRow[];
  bets: BetRow[];
  promoAwards: Record<number, { amount: number; reason: string }>;
  offerTitles?: Array<{ id: number; title: string }>;
  filter: HistoryFilter;
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  // Loaded after mount: reading localStorage during the first render would
  // disagree with the server HTML and break hydration.
  const [viewDensity, setViewDensity] = useState<HistoryViewDensity>("expanded");
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
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
    setFilter(next);
    setLoading(true);
  }

  const loadHistory = useCallback((nextFilter: HistoryFilter, opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    return apiGet<HistoryPayload>(`/api/history?filter=${nextFilter}&limit=200`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let live = true;
    apiGet<HistoryPayload>(`/api/history?filter=${filter}&limit=200`)
      .then((res) => {
        if (!live) return;
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [filter]);

  const ctx = useMemo(
    () =>
      data
        ? buildHistoryContext(
            data.events,
            data.bets,
            data.promoAwards,
            data.offerTitles ?? []
          )
        : buildHistoryContext([], [], {}),
    [data]
  );

  const now = useNow(60_000);

  // Plain derivation - the React Compiler memoizes this better than a manual
  // useMemo it cannot preserve.
  const grouped = (() => {
    if (!data?.entries.length) return [] as Array<[string, HistoryRow[]]>;
    const map = new Map<string, HistoryRow[]>();
    for (const entry of data.entries) {
      const key = formatHistoryDateGroup(entry, ctx, now);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()];
  })();

  return (
    <PageShell>
      <PageHeader
        helpId="history"
        icon={HistoryIcon}
        title="History"
        description="Full timeline of bets, settlements, promos and live match moments - times aligned to when events happened."
        action={
          <Tabs
            value={viewDensity}
            onValueChange={(v) => changeViewDensity(v as HistoryViewDensity)}
            activationMode="manual"
          >
            <TabsList variant="segmented">
              <TabsTrigger value="expanded">
                <LayoutList className="size-3.5 shrink-0" aria-hidden />
                Expanded
              </TabsTrigger>
              <TabsTrigger value="collapsed">
                <Rows3 className="size-3.5 shrink-0" aria-hidden />
                Collapsed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
        toolbar={
          <>
            {HISTORY_FILTERS.map((f) => (
              <FilterPill key={f.id} active={filter === f.id} onClick={() => changeFilter(f.id)}>
                {historyFilterIcon(f.id)}
                {f.label}
              </FilterPill>
            ))}
          </>
        }
      />

      {loading && !data && (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      )}

      {!loading && grouped.length === 0 && (
        <EmptyState
          icon={HistoryIcon}
          title="No history yet"
          description="Track a live event or log a bet - settlements, goals and promo awards will appear here automatically."
          action={{ label: "Browse fixtures", href: "/fixtures" }}
          secondaryAction={{ label: "Open tracker", href: "/tracker" }}
        />
      )}

      <div className="flex flex-col gap-8">
        {grouped.map(([day, entries]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{day}</h2>
            <div className={cn("flex flex-col", collapsed ? "gap-2" : "gap-3")}>
              {entries.map((entry) => (
                <HistoryEntryCard
                  key={entry.id}
                  entry={entry}
                  ctx={ctx}
                  bet={entry.betId != null ? ctx.betsById.get(entry.betId) : undefined}
                  collapsed={collapsed}
                  onFreeBetAwarded={() => void loadHistory(filter, { quiet: true })}
                  onNoteSaved={() => void loadHistory(filter, { quiet: true })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
