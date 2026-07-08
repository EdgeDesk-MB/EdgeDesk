"use client";

import { Gift } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPromoTooltip } from "@/lib/bet-outcomes";
import { cn } from "@/lib/utils";

interface FreeBetAwardBadgeProps {
  amount: number;
  reason?: string;
  /** Position/reason already shown beside the icon — tooltip is amount-only. */
  compact?: boolean;
  className?: string;
  iconClassName?: string;
}

/** Violet gift icon — hover shows free bet value and trigger reason. */
export function FreeBetAwardBadge({
  amount,
  reason,
  compact = false,
  className,
  iconClassName,
}: FreeBetAwardBadgeProps) {
  const label = formatPromoTooltip(amount, reason, compact);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-sm text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-violet-400",
            className
          )}
          aria-label={label}
        >
          <Gift className={cn("size-3.5", iconClassName)} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
