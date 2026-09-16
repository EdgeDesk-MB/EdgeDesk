"use client";

import { Zap } from "lucide-react";
import { moneyPositiveClass } from "@/components/money-flow";
import { twoUpBothWinProfit } from "@/lib/bets/two-up-windfall";
import { formatGbp } from "@/lib/format-money";
import { cn } from "@/lib/utils";

function profitEntryClass(value: number): string {
  const rounded = Number((Number.isFinite(value) ? value : 0).toFixed(2));
  if (rounded === 0) return "text-muted-foreground";
  if (rounded > 0) return moneyPositiveClass;
  return "text-negative";
}

/** 2UP both-win P&L: bookie pays early and the lay also wins. */
export function TwoUpStakesHint({
  bet,
  className,
}: {
  bet: Parameters<typeof twoUpBothWinProfit>[0];
  className?: string;
}) {
  const profit = twoUpBothWinProfit(bet);
  if (profit == null) return null;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 text-xs tabular-nums",
        className
      )}
      title="If the selection goes two up, then fails to win"
    >
      <Zap className="size-3 shrink-0 text-primary-text" aria-hidden />
      <span className="text-muted-foreground">
        2UP (<span className={cn("font-medium", profitEntryClass(profit))}>{formatGbp(profit, { signed: true })}</span>)
      </span>
    </div>
  );
}
