"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyFlow } from "@/components/money-flow";
import { OfferPnlSlice } from "@/components/offers/offer-pnl-slice";
import { MonthlyPnlSection } from "@/components/tracker/monthly-pnl-section";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { BetRow } from "@/lib/db/schema";
import { computeMonthlyBreakdown } from "@/lib/pnl/monthly-breakdown";
import { computeMonthPace, currentMonthAchieved, paceLabel } from "@/lib/pnl/pace";
import { useAppState } from "@/hooks/use-app-state";
import { sectionBar } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarRange, ChevronRight, Tag } from "lucide-react";

function SummaryChip({
  label,
  value,
  sub,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-lift flex items-center gap-2 rounded-md border border-border/80 bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-selection-subtle dark:shadow-none"
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{value}</span>
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function PnlDialogShell({
  title,
  description,
  children,
  footerHref,
  footerLabel,
  open,
  onOpenChange,
  wide,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footerHref: string;
  footerLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(36rem,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md",
          wide && "sm:max-w-xl"
        )}
      >
        <div className={cn(sectionBar, "shrink-0 pr-12")}>
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-base font-bold">{title}</DialogTitle>
            <DialogDescription className="text-[11px] leading-snug">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[var(--layout-card-x)] py-[var(--layout-card-x)]">{children}</div>

        <div className="shrink-0 border-t bg-selection-subtle/50 px-[var(--layout-card-x)] py-[var(--layout-card-x)]">
          <Button variant="outline" className="h-10 w-full" asChild>
            <Link href={footerHref}>{footerLabel}</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardPnlSummaries({
  offers,
  bets,
}: {
  offers: OfferSummary[];
  bets: BetRow[];
}) {
  const [offerOpen, setOfferOpen] = useState(false);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  // Shared polled context (no extra fetch) - only settings are read here.
  const { state } = useAppState();

  const offerStats = useMemo(() => {
    const active = offers.filter((o) => o.status === "active" || o.betCount > 0);
    if (active.length === 0) return null;
    const totals = active.reduce(
      (acc, o) => ({
        qual: acc.qual + o.profit.qualifyingProfit,
        total: acc.total + o.profit.totalProfit,
      }),
      { qual: 0, total: 0 }
    );
    return { count: active.length, ...totals };
  }, [offers]);

  const monthlyStats = useMemo(() => {
    const rows = computeMonthlyBreakdown(bets);
    if (rows.length === 0) return null;
    return { latest: rows[0], allTime: rows.reduce((s, r) => s + r.profit, 0), rows };
  }, [bets]);

  // G1: pace against the user's monthly target - factual copy, no confetti.
  // Pure libs default `now` internally, keeping this memo clean.
  const target = state?.settings.monthlyProfitTarget;
  const pace = useMemo(() => {
    if (!monthlyStats || target == null) return null;
    return computeMonthPace({
      achieved: currentMonthAchieved(monthlyStats.rows),
      target,
    });
  }, [monthlyStats, target]);

  if (!offerStats && !monthlyStats) return null;

  return (
    <>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {offerStats && (
          <SummaryChip
            label="Offer P&L"
            value={<MoneyFlow value={offerStats.total} signColor className="inline text-sm" />}
            sub={`${offerStats.count} offer${offerStats.count === 1 ? "" : "s"}`}
            icon={Tag}
            onClick={() => setOfferOpen(true)}
          />
        )}
        {monthlyStats && (
          <SummaryChip
            label="Monthly P&L"
            value={
              <MoneyFlow value={monthlyStats.latest.profit} signColor className="inline text-sm" />
            }
            sub={monthlyStats.latest.label}
            icon={CalendarRange}
            onClick={() => setMonthlyOpen(true)}
          />
        )}
      </div>

      <PnlDialogShell
        title="Offer P&L"
        description="Qualifying loss, place-refund retention and free-bet conversion."
        open={offerOpen}
        onOpenChange={setOfferOpen}
        footerHref="/offers"
        footerLabel="Manage offers"
      >
        <OfferPnlSlice offers={offers} variant="plain" />
      </PnlDialogShell>

      <PnlDialogShell
        title="Monthly P&L"
        description="Settled profit by calendar month and by bookmaker / exchange."
        open={monthlyOpen}
        onOpenChange={setMonthlyOpen}
        footerHref="/tracker?tab=pnl"
        footerLabel="Full breakdown in tracker"
        wide
      >
        {pace ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-selection-subtle/50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly target
            </span>
            <span className="text-sm font-semibold tabular-nums">
              <MoneyFlow value={pace.achieved} signColor className="inline" />{" "}
              <span className="font-normal text-muted-foreground">
                of £{pace.target.toFixed(0)} · {paceLabel(pace).split("· ").pop()}
              </span>
            </span>
          </div>
        ) : null}
        <MonthlyPnlSection variant="plain" />
      </PnlDialogShell>
    </>
  );
}
