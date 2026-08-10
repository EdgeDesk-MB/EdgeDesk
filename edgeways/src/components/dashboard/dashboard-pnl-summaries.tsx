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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CalendarRange, Tag } from "lucide-react";

function PnlRow({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-semibold tabular-nums">{value}</span>
          {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

export function DashboardPnlSummaries({
  offers,
  bets,
}: {
  offers: OfferSummary[];
  bets: BetRow[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"offer" | "monthly">("offer");
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

  const casinoSettlements = state?.casinoSettlements ?? [];
  const monthlyStats = useMemo(() => {
    const rows = computeMonthlyBreakdown(bets, casinoSettlements);
    if (rows.length === 0) return null;
    return { latest: rows[0], allTime: rows.reduce((s, r) => s + r.profit, 0), rows };
  }, [bets, casinoSettlements]);

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

  // Fall back to whichever tab actually has data (a user with only offers or
  // only settled bets should never land on an empty tab).
  const activeTab = tab === "offer" && !offerStats ? "monthly" : tab === "monthly" && !monthlyStats ? "offer" : tab;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-stretch gap-2 rounded-md py-1 text-left"
      >
        {offerStats && (
          <PnlRow
            label="Offer P&L"
            value={<MoneyFlow value={offerStats.total} signColor className="inline text-sm" />}
            sub={`${offerStats.count} offer${offerStats.count === 1 ? "" : "s"}`}
            icon={Tag}
          />
        )}
        {monthlyStats && (
          <PnlRow
            label="Monthly P&L"
            value={
              <MoneyFlow value={monthlyStats.latest.profit} signColor className="inline text-sm" />
            }
            sub={monthlyStats.latest.label}
            icon={CalendarRange}
          />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(36rem,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <div className={cn(sectionBar, "shrink-0 pr-12")}>
            <DialogHeader className="gap-1 text-left">
              <DialogTitle className="text-base font-bold">Profit &amp; Loss breakdown</DialogTitle>
              <DialogDescription className="text-xs leading-snug">
                Offer P&amp;L and monthly P&amp;L, side by side.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-[var(--layout-card-x)] py-[var(--layout-card-x)]">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setTab(v as typeof tab)}
              activationMode="manual"
              className="gap-3"
            >
              <TabsList variant="segmented" className="w-full">
                <TabsTrigger value="offer" disabled={!offerStats}>
                  Offer P&amp;L
                </TabsTrigger>
                <TabsTrigger value="monthly" disabled={!monthlyStats}>
                  Monthly P&amp;L
                </TabsTrigger>
              </TabsList>

              <TabsContent value="offer" className="outline-none">
                <OfferPnlSlice offers={offers} variant="plain" />
              </TabsContent>

              <TabsContent value="monthly" className="outline-none">
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
              </TabsContent>
            </Tabs>
          </div>

          <div className="shrink-0 border-t bg-selection-subtle/50 px-[var(--layout-card-x)] py-[var(--layout-card-x)]">
            <Button variant="outline" className="h-10 w-full" asChild>
              <Link href={activeTab === "offer" ? "/offers" : "/tracker?tab=pnl"}>
                {activeTab === "offer" ? "Manage offers" : "Full breakdown in tracker"}
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
