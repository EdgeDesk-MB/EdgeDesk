"use client";

/**
 * Casino variance simulator (J4) - Monte Carlo sheet for a wagering offer.
 * Self-contained trigger + dialog. Runs 10,000 sessions CHUNKED on the main
 * thread (500 per tick) so the UI never blocks; the seed is fixed, so the
 * same inputs always show the same distribution.
 *
 * Honesty rules: the volatility ladders are stylised models calibrated to
 * the RTP - not real game maths - so every figure here carries a heuristic
 * basis. Where wagering drag exceeds the bonus the simulated mean sits
 * ABOVE the static H2 EV (you can't lose more than the bonus; busting
 * truncates the loss) - the copy says so instead of hiding the gap.
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { MoneyFlow } from "@/components/money-flow";
import { gbp } from "@/components/casino/casino-ui";
import { DEFAULT_RTP, houseEdgeFromRtp } from "@/lib/calc/casino-ev";
import {
  casinoSimSession,
  mulberry32,
  simulateFinals,
  summariseFinals,
  type CasinoSimInput,
  type CasinoSimResult,
  type SlotVolatility,
} from "@/lib/calc/casino-sim";
import { cn } from "@/lib/utils";

const RUNS = 10_000;
const CHUNK = 500;

export interface CasinoSimOffer {
  title: string;
  bonusAmount: number;
  wageringMultiplier: number;
  /** Fraction (0.96); null = 96% slot default (heuristic either way here) */
  rtp: number | null;
  /** Fraction (0.5 = 50%); null = 100% */
  contributionPct: number | null;
  defaultVolatility?: SlotVolatility;
}

export function CasinoSimDialog({
  offer,
  triggerClassName,
}: {
  offer: CasinoSimOffer;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5", triggerClassName)}>
          <ChartColumn className="size-3.5" aria-hidden /> Simulate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {open ? <CasinoSimContent offer={offer} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CasinoSimContent({ offer }: { offer: CasinoSimOffer }) {
  const [volatility, setVolatility] = useState<SlotVolatility>(
    offer.defaultVolatility ?? "medium"
  );
  const [spinStake, setSpinStake] = useState(
    Math.max(0.1, Math.round((offer.bonusAmount / 50) * 10) / 10)
  );
  const [result, setResult] = useState<CasinoSimResult | null>(null);
  const [progress, setProgress] = useState(0);
  const runToken = useRef(0);

  const run = useCallback(async () => {
    const token = ++runToken.current;
    setResult(null);
    setProgress(0);
    const input: CasinoSimInput = {
      bonusAmount: offer.bonusAmount,
      wageringMultiplier: offer.wageringMultiplier,
      houseEdge: houseEdgeFromRtp(offer.rtp ?? DEFAULT_RTP),
      contributionPct: offer.contributionPct ?? 1,
      volatility,
      spinStake,
      runs: RUNS,
      seed: 1,
    };
    const params = casinoSimSession(input);
    if (!params) return;
    const rng = mulberry32(1);
    const finals: number[] = [];
    let staked = 0;
    for (let done = 0; done < RUNS; done += CHUNK) {
      staked += simulateFinals(params, Math.min(CHUNK, RUNS - done), rng, finals);
      if (runToken.current !== token) return; // superseded by newer inputs
      setProgress((done + CHUNK) / RUNS);
      await new Promise((r) => setTimeout(r, 0));
    }
    if (runToken.current !== token) return;
    setResult(summariseFinals(finals, staked, input));
  }, [offer, volatility, spinStake]);

  useEffect(() => {
    if (!(spinStake > 0)) return;
    // Deferred so the effect never sets state synchronously (compiler rule).
    queueMicrotask(() => void run());
  }, [run, spinStake]);

  const maxCount = result ? Math.max(...result.histogram.counts, 1) : 1;
  const truncationGap = result != null && result.meanEv > result.analyticEv + 0.5;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Simulate · {offer.title}</DialogTitle>
        <DialogDescription>
          {RUNS.toLocaleString()} runs of £{offer.bonusAmount.toFixed(2)} through{" "}
          {offer.wageringMultiplier}× wagering at {(100 * (offer.rtp ?? DEFAULT_RTP)).toFixed(1)}%
          RTP. Stylised volatility model - real games vary.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-end justify-between gap-3">
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
        <NumField
          label="Spin stake"
          prefix="£"
          value={spinStake}
          onChange={setSpinStake}
          min={0.1}
          step={0.1}
          className="w-28"
        />
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
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="Bust"
              value={`${(result.bustPct * 100).toFixed(result.bustPct > 0 && result.bustPct < 0.1 ? 1 : 0)}%`}
              tone={result.bustPct > 0.5 ? "bad" : "muted"}
            />
            <StatTile label="Median" value={gbp(result.median)} tone={result.median > 0 ? "good" : "muted"} />
            <StatTile label="Top decile" value={gbp(result.p90)} tone="good" />
            <StatTile label="Mean retained" value={gbp(result.meanEv)} tone={result.meanEv > 0 ? "good" : "bad"} />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex h-28 items-end gap-px">
              {result.histogram.counts.map((count, i) => (
                <div
                  key={i}
                  className={cn(
                    "min-w-0 flex-1 rounded-t-sm",
                    i === 0 && result.bustPct > 0 ? "bg-destructive/60" : "bg-primary/70"
                  )}
                  style={{ height: `${Math.max(count > 0 ? 3 : 0, (count / maxCount) * 100)}%` }}
                  title={`£${result.histogram.edges[i].toFixed(0)}–£${result.histogram.edges[i + 1].toFixed(0)}: ${count} runs`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span>£0</span>
              <span>£{result.histogram.edges[result.histogram.edges.length - 1].toFixed(0)}+</span>
            </div>
          </div>

          <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>
                Static EV (H2 model):{" "}
                <MoneyFlow value={result.analyticEv} signColor signDisplay className="inline font-semibold" />
                {" · "}simulated mean:{" "}
                <MoneyFlow value={result.meanEv} signColor signDisplay className="inline font-semibold" />
              </span>
              <EvBasisBadge
                basis="heuristic"
                description="Stylised volatility model calibrated to the RTP - not the real game's maths"
              />
            </div>
            {truncationGap ? (
              <p className="mt-1">
                The simulated mean sits above the static figure because a session can only lose
                the bonus - busting stops the drag early. The static model assumes the full
                turnover is always cycled.
              </p>
            ) : null}
            <p className="mt-1">
              10–90% band: {gbp(result.p10)} to {gbp(result.p90)} · mean £
              {result.meanStaked.toFixed(0)} cycled per run · EV is an expectation across many
              attempts, never a lock.
            </p>
          </div>
        </>
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad" | "muted";
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold tabular-nums",
          tone === "good" && "text-success",
          tone === "bad" && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}
