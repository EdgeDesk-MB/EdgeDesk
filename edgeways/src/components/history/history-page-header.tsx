"use client";

import { PageHeader } from "@/components/help/page-header";
import { SportIcon } from "@/components/sport-icon";
import { FilterPill } from "@/components/ui/filter-pill";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HISTORY_FILTERS, type HistoryFilter } from "@/lib/history-display";
import { Dices, History as HistoryIcon, LayoutList, Rows3, Zap } from "lucide-react";

export type HistoryViewDensity = "expanded" | "collapsed";

function historyFilterIcon(id: HistoryFilter) {
  if (id === "match_events") return <SportIcon sport="football" size={12} />;
  if (id === "racing") return <SportIcon sport="horse_racing" size={12} />;
  if (id === "casino") return <Dices className="size-3" />;
  if (id === "boosts") return <Zap className="size-3" />;
  return null;
}

/**
 * History title, density tabs and filter pills. The route's loading state
 * renders it with `disabled`, so the chrome is in place before the page mounts.
 */
export function HistoryPageHeader({
  filter,
  onFilterChange,
  viewDensity,
  onViewDensityChange,
  disabled = false,
}: {
  filter: HistoryFilter;
  onFilterChange?: (next: HistoryFilter) => void;
  viewDensity: HistoryViewDensity;
  onViewDensityChange?: (next: HistoryViewDensity) => void;
  disabled?: boolean;
}) {
  return (
    <PageHeader
      helpId="history"
      rule={false}
      toolbarRule={false}
      icon={HistoryIcon}
      title="History"
      description="Bets, settlements and match moments."
      action={
        <Tabs
          value={viewDensity}
          onValueChange={(v) => onViewDensityChange?.(v as HistoryViewDensity)}
          activationMode="manual"
        >
          <TabsList variant="segmented">
            <TabsTrigger value="expanded" disabled={disabled}>
              <LayoutList className="size-3.5 shrink-0" aria-hidden />
              Expanded
            </TabsTrigger>
            <TabsTrigger value="collapsed" disabled={disabled}>
              <Rows3 className="size-3.5 shrink-0" aria-hidden />
              Collapsed
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
      toolbar={
        <>
          {HISTORY_FILTERS.map((f) => (
            <FilterPill
              key={f.id}
              active={filter === f.id}
              disabled={disabled}
              onClick={() => onFilterChange?.(f.id)}
            >
              {historyFilterIcon(f.id)}
              {f.label}
            </FilterPill>
          ))}
        </>
      }
    />
  );
}
