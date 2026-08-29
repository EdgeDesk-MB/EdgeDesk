"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumField } from "@/components/calc/num-field";
import { MoneyFlow, NumFlow, PercentFlow } from "@/components/money-flow";
import { CalculatorPageHeader } from "@/components/layout/calculator-page-header";
import { CalculatorShell } from "@/components/page-shell";
import { expectedValue, noVig } from "@/lib/calc/ev";
import { Plus, Trash2 } from "lucide-react";

export default function EvCalculatorPage() {
  const [odds, setOdds] = useState(2.2);
  const [stake, setStake] = useState(100);
  const [marketOdds, setMarketOdds] = useState<number[]>([2.1, 3.5, 3.6]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fair = useMemo(() => {
    if (marketOdds.some((o) => !(o > 1))) return null;
    return noVig(marketOdds);
  }, [marketOdds]);

  const trueP = fair?.fairProbabilities[selectedIndex] ?? 0;
  const ev = useMemo(() => {
    if (!(odds > 1 && trueP > 0 && stake > 0)) return null;
    return expectedValue(odds, trueP, stake);
  }, [odds, trueP, stake]);

  return (
    <CalculatorShell wide>
      <CalculatorPageHeader
        title="EV & No-Vig"
        description="Fair odds with the margin stripped out, then your edge."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Market (sharpest odds you can find)</CardTitle>
            <CardDescription>
              Enter every outcome&apos;s price - e.g. the exchange&apos;s home/draw/away. Click an
              outcome to make it your selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {marketOdds.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Button
                  variant={i === selectedIndex ? "default" : "outline"}
                  size="sm"
                  className="w-28 shrink-0"
                  onClick={() => setSelectedIndex(i)}
                >
                  Outcome {i + 1}
                </Button>
                <Input
                  type="number"
                  step={0.01}
                  min={1.01}
                  className="tabular-nums"
                  value={o}
                  onChange={(e) =>
                    setMarketOdds((prev) =>
                      prev.map((x, j) => (j === i ? parseFloat(e.target.value) : x))
                    )
                  }
                />
                <div className="w-20 text-right text-sm text-muted-foreground">
                  {fair ? <PercentFlow value={fair.fairProbabilities[i] * 100} digits={1} /> : "-"}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={marketOdds.length <= 2}
                  onClick={() => {
                    setMarketOdds((prev) => prev.filter((_, j) => j !== i));
                    setSelectedIndex((prev) => Math.min(prev, marketOdds.length - 2));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarketOdds((prev) => [...prev, 3])}
              >
                <Plus className="size-4" /> Add outcome
              </Button>
              <div className="text-xs text-muted-foreground">
                Overround:{" "}
                <span className="font-medium text-foreground">
                  <PercentFlow value={fair?.overroundPct ?? 0} digits={2} />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your bet</CardTitle>
            <CardDescription>The price you&apos;re actually being offered.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Your odds" value={odds} onChange={setOdds} min={1} />
              <NumField label="Stake" prefix="£" value={stake} onChange={setStake} min={0} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground">Fair odds (no vig)</div>
                <div className="text-xl font-semibold">
                  {trueP > 0 ? <NumFlow value={1 / trueP} /> : "-"}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="text-xs text-muted-foreground">True probability</div>
                <div className="text-xl font-semibold">
                  <PercentFlow value={trueP * 100} digits={1} />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-primary-text">Expected value</div>
                  <div className="text-xs text-muted-foreground">
                    Edge:{" "}
                    <span className="font-medium text-foreground">
                      <PercentFlow value={ev?.edgePct ?? 0} signColor digits={2} />
                    </span>
                  </div>
                </div>
                <div className="text-3xl font-semibold">
                  <MoneyFlow value={ev?.evForStake ?? 0} signColor signDisplay estimate />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CalculatorShell>
  );
}
