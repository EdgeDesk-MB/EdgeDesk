"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyFlow } from "@/components/money-flow";
import { CalculatorShell } from "@/components/page-shell";
import { RULE4_PRESETS, rule4Adjust, rule4EffectiveOdds } from "@/lib/calc/rule4";

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your bet</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Stake (£)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="tabular-nums"
              value={stake}
              onChange={(e) => setStake(parseFloat(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Original odds (decimal)</Label>
            <Input
              type="number"
              min={1.01}
              step={0.01}
              className="tabular-nums"
              value={odds}
              onChange={(e) => setOdds(parseFloat(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Rule 4 deduction (p in £)</Label>
            <Input
              type="number"
              min={0}
              max={90}
              step={5}
              className="tabular-nums"
              value={deductionPence}
              onChange={(e) => setDeductionPence(parseFloat(e.target.value))}
            />
          </div>
          <div className="col-span-full flex flex-wrap gap-1.5">
            {RULE4_PRESETS.map((p) => (
              <button
                key={p.pence}
                type="button"
                onClick={() => setDeductionPence(p.pence)}
                className={
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors " +
                  (deductionPence === p.pence
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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
