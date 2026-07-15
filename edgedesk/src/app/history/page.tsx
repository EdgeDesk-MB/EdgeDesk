"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryEntryCard } from "@/components/history/history-feed";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { api } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import {
  buildHistoryContext,
  formatHistoryDateGroup,
  HISTORY_FILTERS,
  type HistoryFilter,
} from "@/lib/history-display";
import { cn } from "@/lib/utils";
import { filterPillState } from "@/lib/ui/surface-styles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SportIcon } from "@/components/sport-icon";
import { History as HistoryIcon, LayoutList, Rows3 } from "lucide-react";

export type HistoryViewDensity = "expanded" | "collapsed";

const HISTORY_VIEW_STORAGE_KEY = "edgedesk:history-view-density";

function readStoredViewDensity(): HistoryViewDensity {
  if (typeof window === "undefined") return "expanded";
  const raw = localStorage.getItem(HISTORY_VIEW_STORAGE_KEY);
  return raw === "collapsed" ? "collapsed" : "expanded";
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
  return null;
}

interface HistoryPayload {
  entries: HistoryRow[];
  events: EventRow[];
  bets: BetRow[];
  promoAwards: Record<number, { amount: number; reason: string }>;
  filter: HistoryFilter;
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [viewDensity, setViewDensity] = useState<HistoryViewDensity>(() => readStoredViewDensity());
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const collapsed = viewDensity === "collapsed";

  function changeViewDensity(next: HistoryViewDensity) {
    setViewDensity(next);
    storeViewDensity(next);
  }

  /** Loading flips in the event handler; the effect only does async work. */
  function changeFilter(next: HistoryFilter) {
    setFilter(next);
    setLoading(true);
  }

  useEffect(() => {
    let live = true;
    api<HistoryPayload>(`/api/history?filter=${filter}&limit=200`)
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
        ? buildHistoryContext(data.events, data.bets, data.promoAwards)
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
              <button
                key={f.id}
                type="button"
                onClick={() => changeFilter(f.id)}
                className={filterPillState(filter === f.id)}
              >
                {historyFilterIcon(f.id)}
                {f.label}
              </button>
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
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
