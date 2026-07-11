"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyFlow, NumFlow, PercentFlow } from "@/components/money-flow";
import { expectedValue, trueProbabilityFromExchange } from "@/lib/calc";
import { Sparkles } from "lucide-react";

interface EdgePanelProps {
  backOdds: number;
  layOdds: number;
  stake: number;
}

/**
 * "Your Edge" - shown on every calculator. Uses the exchange price as the closest
 * proxy for fair value and expresses the bookie price as EV against it.
 */
export function EdgePanel({ backOdds, layOdds, stake }: EdgePanelProps) {
  const valid = backOdds > 1 && layOdds > 1 && stake > 0;
  const trueP = valid ? trueProbabilityFromExchange(layOdds, layOdds) : 0;
  const ev = valid ? expectedValue(backOdds, trueP, stake) : null;

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="size-4" /> Your Edge
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm lg:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Implied prob (bookie)</div>
          <div className="font-semibold">
            {valid ? <PercentFlow value={(1 / backOdds) * 100} digits={1} /> : "-"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Fair prob (exchange)</div>
          <div className="font-semibold">
            {valid ? <PercentFlow value={trueP * 100} digits={1} /> : "-"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Fair odds</div>
          <div className="font-semibold">{valid ? <NumFlow value={1 / trueP} /> : "-"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">EV of back stake</div>
          <div className="font-semibold">
            {ev ? <MoneyFlow value={ev.evForStake} signColor signDisplay /> : "-"}
          </div>
        </div>
        <p className="col-span-2 pt-1 text-[11px] leading-relaxed text-muted-foreground lg:col-span-4">
          Exchange lay odds are your best public estimate of true probability. Backing above fair
          odds is +EV; the lay locks the profit in regardless.
        </p>
      </CardContent>
    </Card>
  );
}
