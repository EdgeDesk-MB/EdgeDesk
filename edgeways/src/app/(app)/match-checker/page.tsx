"use client";

/**
 * Match Checker (F1) - turn a bookie price + exchange lay into a verdict.
 * It checks the match YOU found; it never lists or ranks markets (the
 * oddsmatching line is deliberate - roadmap §7.3).
 */

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useExchanges } from "@/hooks/use-exchanges";
import { checkMatch, type MatchVerdict } from "@/lib/calc/match-verdict";
import type { BetMode } from "@/lib/calc/matched";
import { MoneyFlow } from "@/components/money-flow";
import { cn } from "@/lib/utils";

/**
 * Risk-free is deliberately absent: its verdict depends on refund amount and
 * retention, which need the full calculator's inputs - a silent 70% default
 * here would mislead (calc-auditor finding).
 */
const MODE_LABELS: Partial<Record<BetMode, string>> = {
  qualifying: "Qualifying (cash)",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
};

function verdictChip(verdict: MatchVerdict): { label: string; className: string } {
  switch (verdict) {
    case "good":
      return {
        label: "Good match",
        className: "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400",
      };
    case "ok":
      return { label: "OK match", className: "bg-warning/10 text-warning" };
    case "poor":
      return { label: "Poor match", className: "bg-negative/10 text-negative" };
  }
}

export default function MatchCheckerPage() {
  const { openMatchedCalculator } = useMatchedCalculator();
  const { exchanges } = useExchanges();
  const defaultExchange = exchanges.find((e) => e.isDefault) ?? exchanges[0] ?? null;

  const [mode, setMode] = useState<BetMode>("qualifying");
  const [stake, setStake] = useState("50");
  const [backOdds, setBackOdds] = useState("");
  const [layOdds, setLayOdds] = useState("");
  const [commissionPct, setCommissionPct] = useState<string | null>(null);

  const commission =
    (commissionPct != null
      ? parseFloat(commissionPct)
      : (defaultExchange?.commissionPct ?? 2)) / 100;

  const result = useMemo(
    () =>
      checkMatch({
        mode,
        backStake: parseFloat(stake) || 0,
        backOdds: parseFloat(backOdds) || 0,
        layOdds: parseFloat(layOdds) || 0,
        commission: Number.isFinite(commission) ? commission : 0.02,
      }),
    [mode, stake, backOdds, layOdds, commission]
  );

  const isFreeBet = mode === "free_snr" || mode === "free_sr";
  const chip = result ? verdictChip(result.verdict) : null;

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Match Checker"
        description="Found a price? Enter the back and the lay - Edgeways gives the verdict. It checks your match; it doesn't go looking for them."
        icon={Scale}
      />

      <div className="grid gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">The match</CardTitle>
            <CardDescription>
              Commission prefills from your default exchange
              {defaultExchange ? ` (${defaultExchange.name})` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mc-mode">Bet type</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as BetMode)}>
                <SelectTrigger id="mc-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(MODE_LABELS) as Array<[BetMode, string]>).map(([m, label]) => (
                    <SelectItem key={m} value={m}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mc-stake">{isFreeBet ? "Free bet (£)" : "Back stake (£)"}</Label>
                <Input
                  id="mc-stake"
                  type="number"
                  min={0}
                  step="0.01"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mc-commission">Commission (%)</Label>
                <Input
                  id="mc-commission"
                  type="number"
                  min={0}
                  max={99}
                  step="0.5"
                  value={commissionPct ?? String(defaultExchange?.commissionPct ?? 2)}
                  onChange={(e) => setCommissionPct(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mc-back">Back odds</Label>
                <Input
                  id="mc-back"
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder="e.g. 4.5"
                  value={backOdds}
                  onChange={(e) => setBackOdds(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mc-lay">Lay odds</Label>
                <Input
                  id="mc-lay"
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder="e.g. 4.6"
                  value={layOdds}
                  onChange={(e) => setLayOdds(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verdict</CardTitle>
            <CardDescription>
              {isFreeBet
                ? "Rating is the cash retained from the free bet's face value."
                : "Rating is the stake retained after the qualifying loss."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result && chip ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold",
                      chip.className
                    )}
                  >
                    {chip.label}
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {result.ratingPct.toFixed(1)}%
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Lay stake</dt>
                  <dd className="text-right tabular-nums">£{result.layStake.toFixed(2)}</dd>
                  <dt className="text-muted-foreground">Liability</dt>
                  <dd className="text-right tabular-nums">£{result.liability.toFixed(2)}</dd>
                  <dt className="text-muted-foreground">If back wins</dt>
                  <dd className="text-right tabular-nums">
                    <MoneyFlow value={result.profitIfBackWins} signColor signDisplay />
                  </dd>
                  <dt className="text-muted-foreground">If lay wins</dt>
                  <dd className="text-right tabular-nums">
                    <MoneyFlow value={result.profitIfLayWins} signColor signDisplay />
                  </dd>
                  <dt className="font-medium text-foreground">
                    {isFreeBet ? "Locked-in profit" : "Qualifying cost"}
                  </dt>
                  <dd className="text-right font-semibold tabular-nums">
                    <MoneyFlow value={result.guaranteed} signColor signDisplay />
                  </dd>
                </dl>
                <Button
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    openMatchedCalculator({
                      mode,
                      backStake: parseFloat(stake) || undefined,
                      backOdds: parseFloat(backOdds) || undefined,
                      layOdds: parseFloat(layOdds) || undefined,
                      // The calculator's prefill contract is PERCENT (see
                      // racing-desk-view passing commissionPct), not fraction.
                      commission: commission * 100,
                    })
                  }
                >
                  Open in calculator
                </Button>
              </>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                Enter the back and lay odds to get a verdict.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
