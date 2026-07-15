"use client";

/** Shared Casino desk atoms (H2) - variance chip, money copy, basis wording. */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { varianceTierCopy, type CasinoVarianceTier } from "@/lib/calc/casino-ev";
import { cn } from "@/lib/utils";

const TIER_DOT: Record<CasinoVarianceTier, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

const TIER_TEXT: Record<CasinoVarianceTier, string> = {
  low: "text-emerald-700 dark:text-emerald-300",
  medium: "text-amber-700 dark:text-amber-300",
  high: "text-red-700 dark:text-red-300",
};

export function VarianceChip({
  tier,
  className,
}: {
  tier: CasinoVarianceTier;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-flex cursor-default items-center gap-1", className)}
            aria-label={`Variance: ${varianceTierCopy(tier)}`}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT[tier])} aria-hidden />
            <span className={cn("text-[9px] font-semibold uppercase tracking-wide", TIER_TEXT[tier])}>
              {tier} variance
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
          {varianceTierCopy(tier)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function gbp(value: number): string {
  return value < 0 ? `-£${Math.abs(value).toFixed(2)}` : `+£${value.toFixed(2)}`;
}

export const BASIS_COPY = {
  entered: "Based on the game RTP you entered",
  defaulted: "Using the 96% RTP slot default - enter the game's RTP for accuracy",
} as const;

/** Fired on window whenever a casino offer is created/updated outside the page. */
export const CASINO_CHANGED_EVENT = "edgedesk:casino-offers-changed";
