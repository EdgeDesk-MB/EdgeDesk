"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MoneyFlow } from "@/components/money-flow";
import { DashboardPnlSummaries } from "@/components/dashboard/dashboard-pnl-summaries";
import type { OfferSummary } from "@/lib/services/offers";
import type { BetRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

/** Matches History page header band — page-x inset, section-y vertical rhythm */
const overviewInset =
  "px-[var(--layout-page-x)] py-[var(--layout-section-y)]";

function OverviewMetric({
  label,
  value,
  sub,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </div>
      <p className="mt-1.5 min-h-[1rem] text-[11px] leading-snug text-muted-foreground">{sub}</p>
    </>
  );

  const shell = cn(
    "flex min-w-0 flex-1 flex-col",
    href && "transition-colors hover:bg-selection-subtle/60",
    className
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {inner}
      </Link>
    );
  }

  return <div className={shell}>{inner}</div>;
}

export function DashboardOverviewBar({
  liveTotal,
  settled,
  provisional,
  openBets,
  liveEventCount,
  offers,
  bets,
}: {
  liveTotal: number;
  settled: number;
  provisional: number;
  openBets: number;
  liveEventCount: number;
  offers: OfferSummary[];
  bets: BetRow[];
}) {
  const pnlSub =
    Math.abs(provisional) >= 0.005 ? (
      <>
        Settled <MoneyFlow value={settled} signColor className="inline text-[11px]" />
        {" · "}
        Prov <MoneyFlow value={provisional} signColor signDisplay className="inline text-[11px]" />
      </>
    ) : openBets === 0 ? (
      "All settled — no open positions"
    ) : openBets === 1 ? (
      "1 open bet in tracker"
    ) : (
      `${openBets} open in tracker`
    );

  return (
    <div className="shrink-0 overflow-hidden border-b border-border/60">
      <div
        className={cn(
          "flex flex-col gap-[var(--layout-section-y)] lg:flex-row lg:items-stretch lg:justify-between",
          overviewInset
        )}
      >
        <OverviewMetric
          label="Profit"
          value={<MoneyFlow value={liveTotal} signColor className="inline" />}
          sub={pnlSub}
          href={openBets > 0 && Math.abs(provisional) < 0.005 ? "/tracker" : undefined}
          className="pt-3"
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {liveEventCount > 0 && (
            <Badge variant="active" className="gap-1.5">
              <Radio className="size-3 animate-pulse" /> {liveEventCount} live
            </Badge>
          )}
          <DashboardPnlSummaries offers={offers} bets={bets} />
        </div>
      </div>
    </div>
  );
}
