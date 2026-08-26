import type { HistoryRow } from "@/lib/db/schema";
import {
  isBoostHistoryEntry,
  isFreeBetPlacedHistoryEntry,
  isFreeBetWonHistoryEntry,
  isLockInPlacedHistoryEntry,
  isRacingHistoryEntry,
  type HistoryContext,
} from "@/lib/history-display";
import { FootballIcon, WhistleIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CircleCheck,
  CircleX,
  Dices,
  Flag,
  Gift,
  Lock,
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
      return <Zap className={cn("size-3.5 text-primary-text", className)} />;
    }
    if (freeBetPlaced) {
      return <PlusCircle className={cn("size-3.5", freeBetIconClass, className)} />;
    }
    if (isLockInPlacedHistoryEntry(entry, ctx)) {
      return <Lock className={cn("size-3.5 text-primary-text", className)} />;
    }
    return <PlusCircle className={cn("size-3.5 text-primary-text", className)} />;
  }
  if (entry.kind === "goal") {
    return (
      <FootballIcon
        size={14}
        className={cn("text-profit", className)}
      />
    );
  }
  if (entry.kind === "kickoff") {
    return <Play className={cn("size-3.5 text-primary-text", className)} />;
  }
  if (entry.kind === "full_time") {
    if (isRacingHistoryEntry(entry, ctx)) {
      return <Flag className={cn("size-3.5 text-sky-600 dark:text-sky-400", className)} />;
    }
    return (
      <WhistleIcon
        size={14}
        className={cn("text-sky-600 dark:text-sky-400", className)}
      />
    );
  }
  if (entry.kind === "two_up") {
    return <Zap className={cn("size-3.5 text-primary-text", className)} />;
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
          isCredit && "text-profit",
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
          win && "text-profit",
          loss && "text-negative",
          !win && !loss && "text-muted-foreground",
          className
        )}
      />
    );
  }
  if (win) return <CircleCheck className={cn("size-3.5 text-profit", className)} />;
  if (loss || isFreeBetWonHistoryEntry(entry)) {
    return <CircleX className={cn("size-3.5 text-negative", className)} />;
  }
  return <CircleCheck className={cn("size-3.5 text-muted-foreground", className)} />;
}
