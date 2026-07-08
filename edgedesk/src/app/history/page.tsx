"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HistoryEntryCard } from "@/components/history/history-feed";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { EmptyState } from "@/components/help/empty-state";
import { api } from "@/hooks/use-app-state";
import type { BetRow, EventRow, HistoryRow } from "@/lib/db/schema";
import {
  buildHistoryContext,
  formatHistoryDateGroup,
  HISTORY_FILTERS,
  type HistoryFilter,
} from "@/lib/history-display";
import { cn } from "@/lib/utils";
import { filterPillState } from "@/lib/ui/surface-styles";
import { SportIcon } from "@/components/sport-icon";
import { History as HistoryIcon } from "lucide-react";

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
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextFilter: HistoryFilter) => {
    setLoading(true);
    try {
      const res = await api<HistoryPayload>(`/api/history?filter=${nextFilter}&limit=200`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const ctx = useMemo(
    () =>
      data
        ? buildHistoryContext(data.events, data.bets, data.promoAwards)
        : buildHistoryContext([], [], {}),
    [data]
  );

  const grouped = useMemo(() => {
    if (!data?.entries.length) return [];
    const map = new Map<string, HistoryRow[]>();
    for (const entry of data.entries) {
      const key = formatHistoryDateGroup(entry, ctx);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [data?.entries, ctx]);

  return (
    <PageShell>
      <PageHeader
        helpId="history"
        icon={HistoryIcon}
        title="History"
        description="Full timeline of bets, settlements, promos and live match moments — times aligned to when events happened."
        toolbar={
          <>
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
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
          description="Track a live event or log a bet — settlements, goals and promo awards will appear here automatically."
          action={{ label: "Browse fixtures", href: "/fixtures" }}
          secondaryAction={{ label: "Open tracker", href: "/tracker" }}
        />
      )}

      <div className="flex flex-col gap-8">
        {grouped.map(([day, entries]) => (
          <section key={day}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{day}</h2>
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <HistoryEntryCard
                  key={entry.id}
                  entry={entry}
                  ctx={ctx}
                  bet={entry.betId != null ? ctx.betsById.get(entry.betId) : undefined}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
