"use client";

/**
 * Boosts (J2/J2b) - fair-price verdicts for price boosts and bet builders, plus
 * a diary of EV checks. Logged = diary only; Placed = linked Tracker bet.
 * Settlement only when a bet is committed (same record as Profit Tracker).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import {
  BoostCheckerForm,
  BOOSTS_CHANGED_EVENT,
} from "@/components/boosts/boost-checker-form";
import { useAddBet } from "@/components/add-bet-provider";
import { ManualSettleDialog } from "@/components/tracker/manual-settle-dialog";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { MoneyFlow } from "@/components/money-flow";
import { api, useAppState } from "@/hooks/use-app-state";
import type { SettledBetStatus } from "@/lib/calc";
import {
  BOOST_DIARY_QUEUES,
  boostDiaryToAddBetPrefill,
  filterBoostDiaryByQueue,
  type BoostDiaryEntry,
  type BoostDiaryQueue,
} from "@/lib/services/boosts-client";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function gbp(value: number): string {
  return value < 0 ? `-£${Math.abs(value).toFixed(2)}` : `+£${value.toFixed(2)}`;
}

/** Match Tracker ManualSettleDialog Won / Lost hover treatment. */
function settleOutcomeButtonClass(kind: "won" | "lost"): string {
  if (kind === "won") {
    return cn(
      "h-7 px-2 text-xs focus-visible:border-success/50 focus-visible:ring-success/30",
      "border-border bg-background text-muted-foreground",
      "hover:border-success/40 hover:bg-success/10 hover:text-success"
    );
  }
  return cn(
    "h-7 px-2 text-xs focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
    "border-border bg-background text-muted-foreground",
    "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
  );
}

export default function BoostsPage() {
  const { openAddBet } = useAddBet();
  const { state, refresh } = useAppState(5000);
  const bets = useMemo(() => state?.bets ?? [], [state?.bets]);
  const [entries, setEntries] = useState<BoostDiaryEntry[] | null>(null);
  const [queue, setQueue] = useState<BoostDiaryQueue>("all");
  const [settleBetId, setSettleBetId] = useState<number | null>(null);

  const load = useCallback(() => {
    api<{ entries: BoostDiaryEntry[] }>("/api/boosts")
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(BOOSTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(BOOSTS_CHANGED_EVENT, load);
  }, [load]);

  const settleBet = useMemo(
    () => (settleBetId != null ? bets.find((b) => b.id === settleBetId) ?? null : null),
    [bets, settleBetId]
  );

  async function settleQuick(entry: BoostDiaryEntry, outcome: "won" | "lost" | "void") {
    if (entry.betId == null) return;
    try {
      await api(`/api/boosts/${entry.id}`, { method: "PATCH", json: { outcome } });
      refresh();
      load();
      toast.success(`Marked ${outcome}`);
    } catch (e) {
      toast.error("Could not settle", { description: String(e) });
    }
  }

  async function settleFromModal(status: SettledBetStatus, profit: number) {
    if (settleBetId == null) return;
    try {
      await api(`/api/bets/${settleBetId}`, {
        method: "PATCH",
        json: { status, actualProfit: profit },
      });
      toast.success("Bet settled");
      refresh();
      load();
      window.dispatchEvent(new Event(BOOSTS_CHANGED_EVENT));
    } catch (e) {
      toast.error("Could not settle", { description: String(e) });
    }
  }

  async function remove(entry: BoostDiaryEntry) {
    await api(`/api/boosts/${entry.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  function openPlaceBet(entry: BoostDiaryEntry) {
    openAddBet(boostDiaryToAddBetPrefill(entry));
  }

  function onCardActivate(entry: BoostDiaryEntry) {
    if (entry.betId == null) {
      openPlaceBet(entry);
      return;
    }
    const bet = bets.find((b) => b.id === entry.betId);
    if (bet?.status === "open") {
      setSettleBetId(bet.id);
    }
  }

  const visible = useMemo(
    () => filterBoostDiaryByQueue(entries ?? [], queue),
    [entries, queue]
  );

  const totals = useMemo(() => {
    const list = entries ?? [];
    const realised = list.reduce((s, e) => {
      if (e.linkedBet?.actualProfit != null && e.linkedBet.status !== "open") {
        return s + e.linkedBet.actualProfit;
      }
      if (e.betId == null && e.outcome != null) return s + (e.actualProfit ?? 0);
      return s;
    }, 0);
    const settled = list.filter(
      (e) =>
        (e.linkedBet != null && e.linkedBet.status !== "open") ||
        (e.betId == null && e.outcome != null)
    ).length;
    return {
      evBanked: list.reduce((s, e) => s + e.evGbp, 0),
      realised,
      settled,
      basis: list.some((e) => e.basis === "heuristic")
        ? ("heuristic" as const)
        : ("estimated" as const),
    };
  }, [entries]);

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Boosts"
        description="Found a boosted price or built a bet? Enter it with fair odds - Edgeways gives the verdict and keeps score."
        helpId="boosts"
        icon={Zap}
      />

      <div className="grid gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0 lg:grid-cols-[minmax(0,30rem)_1fr]">
        <BoostCheckerForm />

        {/*
          Offset matches Price boost / Bet builder tabs (h-9) + form gap-3,
          then +12px so EV banked sits just below the Back Bet panel top.
        */}
        <section className="flex min-w-0 flex-col gap-2 lg:pt-[calc(2.25rem+0.75rem+0.75rem)]">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              EV banked <MoneyFlow value={totals.evBanked} signColor className="inline" />
              {entries && entries.length > 0 ? (
                <EvBasisBadge
                  basis={totals.basis}
                  description={
                    totals.basis === "heuristic"
                      ? "Includes builder checks with no correlation haircut set"
                      : "Sum of the EV recorded at each check, from prices you entered"
                  }
                />
              ) : null}
            </span>
            {totals.settled > 0 ? (
              <span className="text-xs text-muted-foreground">
                Realised {gbp(totals.realised)} over {totals.settled} settled
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {BOOST_DIARY_QUEUES.map((q) => {
              const count =
                q.id === "all"
                  ? (entries?.length ?? 0)
                  : filterBoostDiaryByQueue(entries ?? [], q.id).length;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQueue(q.id)}
                  className={cn(filterPillState(queue === q.id))}
                >
                  {q.label}
                  {q.id !== "all" ? (
                    <span className="ml-1 tabular-nums opacity-70">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {entries == null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Zap}
              title={
                queue === "logged"
                  ? "No logged boosts"
                  : queue === "placed"
                    ? "No placed boosts"
                    : "No boosts logged yet"
              }
              description={
                queue === "all"
                  ? "Check a price, log it for later, or place the bet - the diary keeps the edge you banked."
                  : queue === "logged"
                    ? "Log for later saves an EV check here. Place bet opens Add bet to commit it."
                    : "Placed boosts are linked Tracker bets. Settle from here or Profit Tracker."
              }
            />
          ) : (
            visible.map((entry) => {
              const placed = entry.betId != null;
              const openBet = placed && entry.linkedBet?.status === "open";
              const settledBet =
                placed && entry.linkedBet != null && entry.linkedBet.status !== "open";
              const displayProfit =
                settledBet && entry.linkedBet?.actualProfit != null
                  ? entry.linkedBet.actualProfit
                  : entry.actualProfit;

              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  className="flex min-h-[4.5rem] cursor-pointer items-stretch gap-3 rounded-md border border-border/80 bg-card px-3 py-2.5 transition-colors hover:bg-selection-subtle"
                  onClick={() => onCardActivate(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onCardActivate(entry);
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold">{entry.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wide",
                          placed
                            ? "border-primary/25 bg-primary/10 text-primary-text"
                            : "text-muted-foreground"
                        )}
                      >
                        {placed ? "Placed" : "Logged"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {entry.bookmaker ? `${entry.bookmaker} · ` : ""}
                        {entry.kind === "builder" ? "builder" : "boost"} ·{" "}
                        {entry.boostedOdds.toFixed(2)} vs fair {entry.fairOdds.toFixed(2)} · £
                        {entry.stake.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                      <span>
                        EV {gbp(entry.evGbp)}
                        {settledBet
                          ? ` · ${entry.linkedBet?.status} ${gbp(displayProfit ?? 0)}`
                          : openBet
                            ? " · open in Tracker · click to settle"
                            : !placed
                              ? " · click to place bet"
                              : ""}
                      </span>
                      <EvBasisBadge
                        basis={entry.basis}
                        description={
                          entry.basis === "heuristic"
                            ? "Builder check with no correlation haircut - legs assumed independent"
                            : "From the prices entered at check time"
                        }
                      />
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 flex-col items-end justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      {!placed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openPlaceBet(entry)}
                        >
                          Place bet
                        </Button>
                      ) : null}
                      {openBet ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className={settleOutcomeButtonClass("won")}
                            onClick={() => void settleQuick(entry, "won")}
                          >
                            Won
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={settleOutcomeButtonClass("lost")}
                            onClick={() => void settleQuick(entry, "lost")}
                          >
                            Lost
                          </Button>
                        </>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {openBet ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => void settleQuick(entry, "void")}
                        >
                          Void
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground"
                        aria-label={`Delete ${entry.label}`}
                        onClick={() => void remove(entry)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {settleBet ? (
        <ManualSettleDialog
          bet={settleBet}
          open={settleBetId != null}
          onOpenChange={(next) => {
            if (!next) setSettleBetId(null);
          }}
          showTrigger={false}
          onSettle={(status, profit) => void settleFromModal(status, profit)}
        />
      ) : null}
    </PageShell>
  );
}
