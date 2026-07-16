"use client";

/**
 * Boosts (J2) - fair-price verdicts for price boosts and bet builders, plus
 * a diary of the EV banked at decision time. The checker itself is the shared
 * BoostCheckerForm (Add bet idiom: stacked Back/Lay panels, Advanced underlay)
 * - the same form the side-nav quick action opens as a dialog on any page.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import {
  BoostCheckerForm,
  BOOSTS_CHANGED_EVENT,
} from "@/components/boosts/boost-checker-form";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { MoneyFlow } from "@/components/money-flow";
import { api } from "@/hooks/use-app-state";
import type { BoostDiaryRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

function gbp(value: number): string {
  return value < 0 ? `-£${Math.abs(value).toFixed(2)}` : `+£${value.toFixed(2)}`;
}

export default function BoostsPage() {
  const [entries, setEntries] = useState<BoostDiaryRow[] | null>(null);

  const load = useCallback(() => {
    api<{ entries: BoostDiaryRow[] }>("/api/boosts")
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(BOOSTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(BOOSTS_CHANGED_EVENT, load);
  }, [load]);

  async function settle(entry: BoostDiaryRow, outcome: "won" | "lost" | "void") {
    await api(`/api/boosts/${entry.id}`, { method: "PATCH", json: { outcome } }).catch(() => {});
    load();
  }

  async function remove(entry: BoostDiaryRow) {
    await api(`/api/boosts/${entry.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  const totals = useMemo(() => {
    const list = entries ?? [];
    return {
      evBanked: list.reduce((s, e) => s + e.evGbp, 0),
      realised: list
        .filter((e) => e.outcome != null)
        .reduce((s, e) => s + (e.actualProfit ?? 0), 0),
      settled: list.filter((e) => e.outcome != null).length,
      // A2: the total inherits the weakest basis among its rows.
      basis: list.some((e) => e.basis === "heuristic")
        ? ("heuristic" as const)
        : ("estimated" as const),
    };
  }, [entries]);

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Boosts"
        description="Found a boosted price or built a bet? Enter it with fair odds - EdgeDesk gives the verdict and keeps score."
        helpId="boosts"
        icon={Zap}
      />

      <div className="grid gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0 lg:grid-cols-[minmax(0,30rem)_1fr]">
        <BoostCheckerForm />

        <section className="flex min-w-0 flex-col gap-2">
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

          {entries == null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No boosts logged yet"
              description="Check a price, log it, and the diary keeps a running score of the edge you banked - and what it actually paid."
            />
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-md border bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{entry.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.bookmaker ? `${entry.bookmaker} · ` : ""}
                      {entry.kind === "builder" ? "builder" : "boost"} · {entry.boostedOdds.toFixed(2)} vs fair{" "}
                      {entry.fairOdds.toFixed(2)} · £{entry.stake.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
                    <span>
                      EV {gbp(entry.evGbp)}
                      {entry.outcome
                        ? ` · ${entry.outcome} ${gbp(entry.actualProfit ?? 0)}`
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
                <div className="flex shrink-0 items-center gap-1">
                  {entry.outcome == null ? (
                    <>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void settle(entry, "won")}>
                        Won
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void settle(entry, "lost")}>
                        Lost
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void settle(entry, "void")}>
                        Void
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-7 text-muted-foreground")}
                    aria-label={`Delete ${entry.label}`}
                    onClick={() => void remove(entry)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </PageShell>
  );
}
