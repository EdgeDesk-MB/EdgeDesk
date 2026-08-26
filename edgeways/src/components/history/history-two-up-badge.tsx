import { Zap } from "lucide-react";
import { historyTwoUpBadge } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Compact 2UP mark on the Goal! that first put a side two ahead. */
export function HistoryTwoUpBadge({ className }: { className?: string }) {
  return (
    <span className={cn(historyTwoUpBadge, className)} aria-hidden>
      <Zap className="size-3" />
      2UP
    </span>
  );
}
