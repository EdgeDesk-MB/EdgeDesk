"use client";

/**
 * Combined-campaign Monte Carlo sheet (K2) - one distribution across every
 * component on a campaign, superseding the old per-Bonus-only simulator
 * (casino-sim-dialog.tsx, removed). Same chunked-on-the-main-thread pattern
 * J4 established; a single-Bonus campaign is just the degenerate case of
 * the same combined function, not a separate code path.
 *
 * Honesty rules unchanged: volatility ladders are stylised, not real game
 * maths, so every figure here carries a heuristic basis. Where a component
 * has heavy drag relative to its own stake, busting/clamping can push the
 * simulated mean away from the static K1 figure - the copy says so.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { MoneyFlow } from "@/components/money-flow";
import {
  simulateCampaignFinals,
  summariseCampaignFinals,
  type CampaignSimComponent,
  type CampaignSimResult,
} from "@/lib/calc/casino-campaign-sim";
import { mulberry32, type SlotVolatility } from "@/lib/calc/casino-sim";
import { cn } from "@/lib/utils";

const RUNS = 10_000;
const CHUNK = 500;

export function CasinoCampaignSimDialog({
  title,
  components,
  /** The campaign's already-locked total EV (CasinoOfferSummary.expectedEv) - shown as the static side-by-side figure, never recomputed here. */
  analyticEv,
  defaultVolatility,
  triggerClassName,
  mobile = "sheet",
}: {
  title: string;
  components: CampaignSimComponent[];
  analyticEv: number;
  defaultVolatility?: SlotVolatility;
  triggerClassName?: string;
  mobile?: "sheet" | "center";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Controlled open (not DialogTrigger) so the Button stays on the Press path. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <ChartColumn className="size-3.5" aria-hidden /> Simulate
      </Button>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" mobile={mobile}>
        {open ? (
          <CasinoCampaignSimContent
            title={title}
            components={components}
            analyticEv={analyticEv}
            defaultVolatility={defaultVolatility}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CasinoCampaignSimContent({
  title,
  components,
  analyticEv,
  defaultVolatility,
}: {
  title: string;
  components: CampaignSimComponent[];
  analyticEv: number;
  defaultVolatility?: SlotVolatility;
}) {
  const [volatility, setVolatility] = useState<SlotVolatility>(defaultVolatility ?? "medium");
  const [result, setResult] = useState<CampaignSimResult | null>(null);
  const [simulating, setSimulating] = useState(true);
  const [progress, setProgress] = useState(0);
  const runToken = useRef(0);

  const run = useCallback(async () => {
    const token = ++runToken.current;
    setSimulating(true);
    setProgress(0);
    const rng = mulberry32(1);
    const finals: number[] = [];
    for (let done = 0; done < RUNS; done += CHUNK) {
      simulateCampaignFinals(components, volatility, Math.min(CHUNK, RUNS - done), rng, finals);
      if (runToken.current !== token) return; // superseded by newer inputs
      setProgress((done + CHUNK) / RUNS);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (runToken.current !== token) return;
    setResult(summariseCampaignFinals(finals, analyticEv));
    setSimulating(false);
  }, [components, volatility, analyticEv]);

  useEffect(() => {
    queueMicrotask(() => void run());
  }, [run]);

  const maxCount = result ? Math.max(...result.histogram.counts, 1) : 1;

  // Only mark £0 when the distribution actually straddles it - a campaign
  // that can never be negative (or never positive) has no boundary to show.
  const zeroLinePct = (() => {
    if (!result) return null;
    const edges = result.histogram.edges;
    const lo = edges[0];
    const hi = edges[edges.length - 1];
    if (lo >= 0 || hi <= 0) return null;
    return Math.min(100, Math.max(0, ((0 - lo) / (hi - lo)) * 100));
  })();

  return (
    <>
      <DialogHeader>
        <DialogTitle>Simulate</DialogTitle>
        <DialogDescription>
          {title} · {RUNS.toLocaleString()} runs. Real games vary.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Volatility</span>
        <Tabs value={volatility} onValueChange={(v) => setVolatility(v as SlotVolatility)}>
          <TabsList>
            <TabsTrigger value="low">Low</TabsTrigger>
            <TabsTrigger value="medium">Medium</TabsTrigger>
            <TabsTrigger value="high">High</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {result == null ? (
        <div className="flex flex-col gap-2 py-6">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">Simulating…</p>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col gap-3 transition-opacity",
            simulating && "pointer-events-none opacity-60"
          )}
        >
          {simulating ? (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Net loss"
              value={`${(result.lossPct * 100).toFixed(result.lossPct > 0 && result.lossPct < 0.1 ? 1 : 0)}%`}
              tone={result.lossPct > 0.5 ? "bad" : "muted"}
            />
            <StatTile label="Median" money={result.median} />
            <StatTile label="Top decile" money={result.p90} />
            <StatTile label="Mean retained" money={result.meanEv} />
          </div>

          <div className="flex flex-col gap-1">
            <div className="relative flex h-28 items-end gap-px">
              {result.histogram.counts.map((count, i) => (
                <div
                  key={i}
                  className={cn(
                    "min-w-0 flex-1 rounded-t-sm",
                    result.histogram.edges[i] < 0 ? "bg-destructive/60" : "bg-primary/70"
                  )}
                  style={{ height: `${Math.max(count > 0 ? 3 : 0, (count / maxCount) * 100)}%` }}
                  title={`£${result.histogram.edges[i].toFixed(0)}–£${result.histogram.edges[i + 1].toFixed(0)}: ${count} runs`}
                />
              ))}
              {zeroLinePct != null ? (
                <div
                  className="absolute inset-y-0 w-px bg-foreground/30"
                  style={{ left: `${zeroLinePct}%` }}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="relative text-[11px] tabular-nums text-muted-foreground">
              <div className="flex justify-between">
                <span>£{result.histogram.edges[0].toFixed(0)}</span>
                <span>£{result.histogram.edges[result.histogram.edges.length - 1].toFixed(0)}+</span>
              </div>
              {zeroLinePct != null ? (
                <span
                  className="absolute top-0 -translate-x-1/2 font-medium text-foreground/70"
                  style={{ left: `${zeroLinePct}%` }}
                >
                  £0
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Static vs simulated
              </span>
              <EvBasisBadge
                basis="heuristic"
                description="Stylised volatility model calibrated to the RTP - not the real game's maths"
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
              <span>
                Static EV (K1 model){" "}
                <MoneyFlow value={result.analyticEv} signColor signDisplay estimate className="font-semibold" />
              </span>
              <span>
                Simulated mean{" "}
                <MoneyFlow value={result.meanEv} signColor signDisplay estimate className="font-semibold" />
              </span>
            </div>
            <p className="mt-1.5">
              10–90% band:{" "}
              <MoneyFlow value={result.p10} signColor signDisplay estimate className="inline" /> to{" "}
              <MoneyFlow value={result.p90} signColor signDisplay estimate className="inline" /> · EV is an
              expectation across many attempts, never a lock.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Two mutually exclusive ways to colour a tile - `money` renders through
 * MoneyFlow so every £ figure in this dialog (and everywhere else in the
 * app) shares EXACTLY the same green/red, never a hand-rolled approximation
 * that can visibly drift from it (Total EV, Static EV and the 10-90 band in
 * this same dialog all go through MoneyFlow already). `tone` is only for
 * the one non-money tile (Net loss, a percentage).
 */
function StatTile({
  label,
  value,
  money,
  tone,
}: {
  label: string;
} & (
  | { value: string; tone: "bad" | "muted"; money?: undefined }
  | { money: number; value?: undefined; tone?: undefined }
)) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {money != null ? (
        <MoneyFlow
          value={money}
          signColor
          signDisplay
          estimate
          className="text-sm font-bold tabular-nums"
        />
      ) : (
        <p
          className={cn("text-sm font-bold tabular-nums", tone === "bad" && "text-negative")}
        >
          {value}
        </p>
      )}
    </div>
  );
}
