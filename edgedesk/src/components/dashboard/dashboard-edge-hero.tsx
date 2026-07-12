"use client";

import { MoneyFlow } from "@/components/money-flow";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { sumActionableEv, type DoNextItem } from "@/lib/offers/do-next";
import { cn } from "@/lib/utils";

interface DashboardEdgeHeroProps {
  items: DoNextItem[];
  className?: string;
}

/**
 * One-number headline above the Do Next strip: total actionable EV on the table right now.
 * Receives pre-computed items so no duplicate data fetch.
 * Renders nothing when total < £1 (no edge queued).
 */
export function DashboardEdgeHero({ items, className }: DashboardEdgeHeroProps) {
  const { total, weakestBasis } = sumActionableEv(items);

  if (total < 1) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-[var(--layout-page-x)] pb-1 pt-4",
          className
        )}
      >
        <p className="text-xs text-muted-foreground/60">No edge queued — add offers to get started.</p>
      </div>
    );
  }

  return (
    <div
      className={cn("px-[var(--layout-page-x)] pb-1 pt-4", className)}
    >
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">
        Edge on the table
      </p>
      <div className="flex items-end gap-2.5">
        <MoneyFlow
          value={total}
          signColor
          signDisplay
          className="text-3xl font-bold leading-none"
        />
        <EvBasisBadge basis={weakestBasis} className="mb-0.5" />
      </div>
    </div>
  );
}
