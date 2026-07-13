"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { EvBasis } from "@/lib/offers/advantage";
import { cn } from "@/lib/utils";

const LABELS: Record<EvBasis, string> = {
  live: "Live",
  estimated: "Est.",
  heuristic: "~Est.",
};

const DESCRIPTIONS: Record<EvBasis, string> = {
  live: "Derived from live exchange odds",
  estimated: "Based on your entered expected profit or measured retention rate",
  heuristic: "Rough estimate — set expected profit or add more conversions for accuracy",
};

const DOT_CLASS: Record<EvBasis, string> = {
  live: "bg-emerald-500",
  estimated: "bg-sky-500",
  heuristic: "bg-amber-400",
};

const TEXT_CLASS: Record<EvBasis, string> = {
  live: "text-emerald-700 dark:text-emerald-300",
  estimated: "text-sky-700 dark:text-sky-300",
  heuristic: "text-amber-700 dark:text-amber-300",
};

export function EvBasisBadge({ basis, className }: { basis: EvBasis; className?: string }) {
  return (
    <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-flex cursor-default items-center gap-1", className)}
          aria-label={`EV basis: ${DESCRIPTIONS[basis]}`}
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[basis])} aria-hidden />
          <span className={cn("text-[9px] font-semibold uppercase tracking-wide", TEXT_CLASS[basis])}>
            {LABELS[basis]}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px] text-center text-xs">
        {DESCRIPTIONS[basis]}
      </TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}
