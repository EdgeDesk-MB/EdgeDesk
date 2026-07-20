"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackPanel, PanelInput } from "@/components/calc/bet-panels";
import { MoneyFlow } from "@/components/money-flow";
import { CalculatorShell } from "@/components/page-shell";
import { RULE4_PRESETS, rule4Adjust, rule4EffectiveOdds } from "@/lib/calc/rule4";
import { cn } from "@/lib/utils";

export default function Rule4CalculatorPage() {
  const [stake, setStake] = useState(10);
  const [odds, setOdds] = useState(5);
  const [deductionPence, setDeductionPence] = useState(10);

  const result = useMemo(() => {
    if (!(stake > 0 && odds > 1)) return null;
    return rule4Adjust(stake, odds, deductionPence);
  }, [stake, odds, deductionPence]);

  return (
    <CalculatorShell contentClassName="max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rule 4 Calculator</h1>
        <p className="text-sm text-muted-foreground">
          When a horse is withdrawn, bookies apply a Rule 4 deduction to your winnings. Enter the
          original odds and deduction (pence in the £) to get effective odds and adjusted returns.
        </p>
      </div>

      <BackPanel title="Your bet">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PanelInput label="Stake" prefix="£" value={stake} onChange={setStake} min={0} />
          <PanelInput label="Original odds (decimal)" value={odds} onChange={setOdds} min={1.01} />
          <PanelInput
            label="Rule 4 deduction (p in £)"
            value={deductionPence}
            onChange={setDeductionPence}
            min={0}
            step={5}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RULE4_PRESETS.map((p) => (
            <button
              key={p.pence}
              type="button"
              onClick={() => setDeductionPence(p.pence)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                deductionPence === p.pence
                  ? "bg-black/80 text-white dark:bg-white/90 dark:text-black"
                  : "bg-black/10 text-black/70 hover:bg-black/15 dark:bg-white/15 dark:text-white/80 dark:hover:bg-white/20"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </BackPanel>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">After Rule 4</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Effective odds</div>
              <div className="text-2xl font-semibold tabular-nums">
                {result.effectiveOdds.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Adjusted winnings</div>
              <div className="text-2xl font-semibold tabular-nums">
                <MoneyFlow value={result.adjustedWinnings} />
              </div>
              <div className="text-xs text-muted-foreground">
                was <MoneyFlow value={result.originalWinnings} /> at full odds
              </div>
            </div>
            <div className="col-span-full text-xs text-muted-foreground">
              Total return if win:{" "}
              <span className="font-semibold text-foreground">
                <MoneyFlow value={stake + result.adjustedWinnings} />
              </span>{" "}
              (stake + adjusted winnings)
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Quick reference</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4">Deduction</th>
                <th className="pb-2">Effective odds @ {odds.toFixed(2)}</th>
              </tr>
            </thead>
            <tbody>
              {[5, 10, 15, 20, 25, 30, 40, 50].map((p) => (
                <tr key={p} className="border-b border-dashed last:border-0">
                  <td className="py-1.5 pr-4 tabular-nums">{p}p</td>
                  <td className="py-1.5 tabular-nums">{rule4EffectiveOdds(odds, p).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </CalculatorShell>
  );
}
