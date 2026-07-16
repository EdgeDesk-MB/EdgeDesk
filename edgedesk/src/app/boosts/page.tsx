"use client";

/**
 * Boosts (J2) - fair-price verdicts for price boosts and bet builders, plus
 * a diary of the EV banked at decision time. Manual entry only: the user
 * types the prices they see (no odds fetching - D2 intact). The incumbents
 * sell boost FINDERS; this is the checker half, personal and honest.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { MoneyFlow } from "@/components/money-flow";
import { api } from "@/hooks/use-app-state";
import {
  boostVerdict,
  betBuilderFairOdds,
  type BoostCall,
} from "@/lib/calc/boost-check";
import type { BoostDiaryRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const VERDICT_CHIP: Record<BoostCall, { label: string; className: string }> = {
  take: { label: "Take it", className: "border-success/25 bg-success/10 text-success" },
  marginal: {
    label: "Marginal",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  skip: { label: "Skip", className: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
};

function gbp(value: number): string {
  return value < 0 ? `-£${Math.abs(value).toFixed(2)}` : `+£${value.toFixed(2)}`;
}

export default function BoostsPage() {
  const [mode, setMode] = useState<"boost" | "builder">("boost");
  const [label, setLabel] = useState("");
  const [bookmaker, setBookmaker] = useState("");
  const [stake, setStake] = useState(10);
  const [boostedOdds, setBoostedOdds] = useState(NaN);
  const [exchangeBack, setExchangeBack] = useState(NaN);
  const [exchangeLay, setExchangeLay] = useState(NaN);
  // Builder mode
  const [legs, setLegs] = useState<number[]>([NaN, NaN]);
  const [haircutPct, setHaircutPct] = useState(0);
  const [haircutTouched, setHaircutTouched] = useState(false);
  const [entries, setEntries] = useState<BoostDiaryRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ entries: BoostDiaryRow[] }>("/api/boosts")
      .then((r) => setEntries(r.entries))
      .catch(() => setEntries([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const builderFair = useMemo(() => {
    const valid = legs.filter((l) => Number.isFinite(l) && l > 1);
    if (valid.length === 0 || valid.length !== legs.length) return null;
    return betBuilderFairOdds(valid.map((fairOdds) => ({ fairOdds })), haircutPct);
  }, [legs, haircutPct]);

  const verdict = useMemo(() => {
    if (mode === "boost") {
      if (![boostedOdds, exchangeBack, exchangeLay].every((v) => Number.isFinite(v))) return null;
      return boostVerdict({ boostedOdds, exchangeBack, exchangeLay, stake });
    }
    if (!Number.isFinite(boostedOdds) || builderFair == null) return null;
    // Builder: fair odds come from the leg product; verdict at the offered price.
    return boostVerdict({
      boostedOdds,
      exchangeBack: builderFair,
      exchangeLay: builderFair,
      stake,
    });
  }, [mode, boostedOdds, exchangeBack, exchangeLay, stake, builderFair]);

  const basis = mode === "boost" || haircutTouched ? "estimated" : "heuristic";

  async function logToDiary() {
    if (!verdict || !label.trim()) return;
    setSaving(true);
    try {
      await api("/api/boosts", {
        method: "POST",
        json: {
          label: label.trim(),
          bookmaker: bookmaker.trim() || undefined,
          kind: mode,
          boostedOdds,
          fairOdds: verdict.fairOdds,
          stake,
          evGbp: verdict.evGbp,
          basis,
        },
      });
      setLabel("");
      load();
    } finally {
      setSaving(false);
    }
  }

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

  const chip = verdict ? VERDICT_CHIP[verdict.verdict] : null;

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Boosts"
        description="Found a boosted price or built a bet? Enter it with fair odds - EdgeDesk gives the verdict and keeps score."
        helpId="boosts"
        icon={Zap}
      />

      <div className="grid gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList>
              <TabsTrigger value="boost">Price boost</TabsTrigger>
              <TabsTrigger value="builder">Bet builder</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="boost-label" className="text-xs text-muted-foreground">
                Selection
              </Label>
              <Input
                id="boost-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Salah anytime scorer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="boost-bookie" className="text-xs text-muted-foreground">
                Bookmaker
              </Label>
              <Input
                id="boost-bookie"
                value={bookmaker}
                onChange={(e) => setBookmaker(e.target.value)}
                placeholder="e.g. Sky Bet"
              />
            </div>
            <NumField
              label={mode === "boost" ? "Boosted odds" : "Offered builder odds"}
              value={boostedOdds}
              onChange={setBoostedOdds}
              min={1.01}
              step={0.01}
              placeholder="3.00"
            />
            <NumField label="Stake" prefix="£" value={stake} onChange={setStake} min={0} />
          </div>

          {mode === "boost" ? (
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Exchange back"
                value={exchangeBack}
                onChange={setExchangeBack}
                min={1.01}
                step={0.01}
                placeholder="2.60"
              />
              <NumField
                label="Exchange lay"
                value={exchangeLay}
                onChange={setExchangeLay}
                min={1.01}
                step={0.01}
                placeholder="2.70"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">
                Fair odds per leg (from the exchange or your own read)
              </Label>
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <NumField
                    label={`Leg ${i + 1}`}
                    value={leg}
                    onChange={(v) => setLegs(legs.map((l, j) => (j === i ? v : l)))}
                    min={1.01}
                    step={0.01}
                    placeholder="2.00"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-5 size-8 text-muted-foreground"
                    aria-label={`Remove leg ${i + 1}`}
                    disabled={legs.length <= 1}
                    onClick={() => setLegs(legs.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setLegs([...legs, NaN])}
                >
                  <Plus className="size-3.5" /> Add leg
                </Button>
                <NumField
                  label="Correlation haircut (%)"
                  value={haircutPct}
                  onChange={(v) => {
                    setHaircutPct(Number.isFinite(v) ? v : 0);
                    setHaircutTouched(true);
                  }}
                  min={0}
                  step={5}
                  className="w-40"
                  hint={haircutTouched ? undefined : "Same-match legs are correlated - fair is shorter than the product"}
                />
              </div>
              {builderFair != null ? (
                <p className="text-xs text-muted-foreground">
                  Fair builder odds: <span className="font-medium tabular-nums">{builderFair.toFixed(2)}</span>
                </p>
              ) : null}
            </div>
          )}

          <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Verdict
              </span>
              {verdict && chip ? (
                <span className="flex items-center gap-2">
                  <EvBasisBadge
                    basis={basis}
                    description={
                      basis === "heuristic"
                        ? "Assumes independent legs - set a correlation haircut for a fairer price"
                        : "Based on the prices you entered"
                    }
                  />
                  <Badge variant="outline" className={chip.className}>
                    {chip.label}
                  </Badge>
                </span>
              ) : null}
            </div>
            {verdict ? (
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {verdict.edgePct >= 0 ? "+" : ""}
                {verdict.edgePct.toFixed(1)}% edge · EV {gbp(verdict.evGbp)}{" "}
                <span className="font-normal text-muted-foreground">
                  · fair {verdict.fairOdds.toFixed(2)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the prices to get a verdict.
              </p>
            )}
          </div>

          <Button
            onClick={() => void logToDiary()}
            disabled={saving || !verdict || !label.trim()}
          >
            Log to diary
          </Button>
        </section>

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
