import { Zap } from "lucide-react";
import { historyTwoUpBadgeState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Compact 2UP mark on the Goal! that first put a side two ahead. */
export function HistoryTwoUpBadge({
  backed = false,
  className,
}: {
  backed?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      className={cn(historyTwoUpBadgeState(backed), className)}
      aria-label={backed ? "2UP, you backed this side" : "2UP, this side was not backed"}
    >
      <Zap className="size-3" aria-hidden />
      2UP
    </span>
  );
}
