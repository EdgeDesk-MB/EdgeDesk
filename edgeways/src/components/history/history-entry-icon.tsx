import type { HistoryRow } from "@/lib/db/schema";
import {
  isBoostHistoryEntry,
  isFreeBetPlacedHistoryEntry,
  isFreeBetWonHistoryEntry,
  type HistoryContext,
} from "@/lib/history-display";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CircleCheck,
  CircleX,
  Dices,
  Flag,
  Gift,
  Goal,
  Play,
  PlusCircle,
  Zap,
} from "lucide-react";

const freeBetIconClass = "text-violet-600 dark:text-violet-400";

/** Feed + chart icon for a history row — keep in sync with feed styling. */
export function HistoryEntryIcon({
  entry,
  ctx,
  className,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  className?: string;
}) {
  const freeBetPlaced = isFreeBetPlacedHistoryEntry(entry, ctx);
  const win = (entry.amount ?? 0) > 0.004;
  const loss = (entry.amount ?? 0) < -0.004;

  if (entry.kind === "bet_placed") {
    if (isBoostHistoryEntry(entry, ctx)) {
      return <Zap className={cn("size-3.5 text-primary", className)} />;
    }
    if (freeBetPlaced) {
      return <PlusCircle className={cn("size-3.5", freeBetIconClass, className)} />;
    }
    return <PlusCircle className={cn("size-3.5 text-primary", className)} />;
  }
  if (entry.kind === "goal") {
    return <Goal className={cn("size-3.5 text-emerald-600 dark:text-emerald-400", className)} />;
  }
  if (entry.kind === "kickoff") {
    return <Play className={cn("size-3.5 text-primary", className)} />;
  }
  if (entry.kind === "full_time") {
    return <Flag className={cn("size-3.5 text-sky-600 dark:text-sky-400", className)} />;
  }
  if (entry.kind === "two_up") {
    return <Zap className={cn("size-3.5 text-amber-500", className)} />;
  }
  if (entry.kind === "free_bet_promo") {
    return <Gift className={cn("size-3.5", freeBetIconClass, className)} />;
  }
  if (entry.kind === "balance_adjustment") {
    const isCredit = (entry.amount ?? 0) > 0.004;
    const isDebit = (entry.amount ?? 0) < -0.004;
    return (
      <Banknote
        className={cn(
          "size-3.5",
          isCredit && "text-emerald-600",
          isDebit && "text-negative",
          !isCredit && !isDebit && "text-muted-foreground",
          className
        )}
      />
    );
  }
  if (entry.kind === "casino_settlement") {
    return (
      <Dices
        className={cn(
          "size-3.5",
          win && "text-emerald-600",
          loss && "text-negative",
          !win && !loss && "text-muted-foreground",
          className
        )}
      />
    );
  }
  if (win) return <CircleCheck className={cn("size-3.5 text-emerald-600", className)} />;
  if (loss || isFreeBetWonHistoryEntry(entry)) {
    return <CircleX className={cn("size-3.5 text-negative", className)} />;
  }
  return <CircleCheck className={cn("size-3.5 text-muted-foreground", className)} />;
}
