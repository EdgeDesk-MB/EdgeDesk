"use client";

/** Shared Casino desk atoms (H2) - variance chip, money copy, basis wording. */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_RTP,
  houseEdgeFromRtp,
  varianceTier,
  varianceTierCopy,
  type CasinoVarianceTier,
} from "@/lib/calc/casino-ev";
import type { CasinoComponentType } from "@/lib/calc/casino-reward-ev";
import { formatRtpPct } from "@/lib/casino/game-library";
import type { CasinoOfferComponentRow } from "@/lib/db/schema";
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

export const COMPONENT_LABELS: Record<CasinoComponentType, string> = {
  qualifying_wager: "Qualifying wager",
  cash: "Cash",
  bonus: "Bonus",
  free_spins: "Free spins",
  golden_chips: "Golden chips",
  cashback: "Cashback",
};

const EDGE_PRESET_LABEL: Record<"european" | "american" | "custom", string> = {
  european: "European",
  american: "American",
  custom: "Custom",
};

/** One-line summary of a component's own inputs, for the campaign card's breakdown list. */
export function componentSummaryLine(c: CasinoOfferComponentRow): string {
  const rtpPct = formatRtpPct(c.rtp ?? DEFAULT_RTP);
  switch (c.componentType) {
    case "qualifying_wager":
      return `£${(c.amount ?? 0).toFixed(2)} wagered · ${rtpPct} RTP`;
    case "cash":
      return `£${(c.amount ?? 0).toFixed(2)} cash, no wagering`;
    case "bonus":
      return `£${(c.amount ?? 0).toFixed(2)} · ${c.wageringMultiplier ?? 0}× wagering · ${rtpPct} RTP`;
    case "free_spins": {
      const winnings = c.wageringMultiplier ? ` · winnings ${c.wageringMultiplier}× wagered` : "";
      return `${c.spins ?? 0} spins @ £${(c.spinValue ?? 0).toFixed(2)} · ${rtpPct} RTP${winnings}`;
    }
    case "golden_chips":
      return `${c.chipCount ?? 0} chips @ £${(c.chipValue ?? 0).toFixed(2)} · ${EDGE_PRESET_LABEL[c.houseEdgePreset ?? "custom"]} edge`;
    case "cashback":
      return `£${(c.amount ?? 0).toFixed(2)} turnover · ${c.cashbackPct != null ? Math.round(c.cashbackPct * 100) : 0}% cashback${c.cashbackCap != null ? ` (cap £${c.cashbackCap.toFixed(2)})` : ""}`;
  }
}

/**
 * Campaign-level variance tier (K1): sourced only from components with a
 * genuine wagering-bust risk shape - Bonus, Free Spins WITH winnings
 * wagering, and Cashback. Cash, Golden Chips and a qualifying wager alone
 * don't carry that shape, so they're excluded rather than dragging the
 * chip toward a misleading tier. Returns the WORST tier among the
 * qualifying components, or null if none apply (no chip shown).
 */
export function campaignVarianceTier(
  components: CasinoOfferComponentRow[]
): CasinoVarianceTier | null {
  const order: CasinoVarianceTier[] = ["low", "medium", "high"];
  let worst: CasinoVarianceTier | null = null;
  for (const c of components) {
    const houseEdge = houseEdgeFromRtp(c.rtp ?? DEFAULT_RTP);
    let tier: CasinoVarianceTier | null = null;
    if (c.componentType === "bonus") {
      tier = varianceTier({
        wageringMultiplier: c.wageringMultiplier ?? 0,
        houseEdge,
        contributionPct: c.contributionPct ?? undefined,
      });
    } else if (c.componentType === "free_spins" && (c.wageringMultiplier ?? 0) > 0) {
      tier = varianceTier({
        wageringMultiplier: c.wageringMultiplier ?? 0,
        houseEdge,
        contributionPct: c.contributionPct ?? undefined,
      });
    } else if (c.componentType === "cashback") {
      // A cashback offer's "bust" shape is the underlying play's own variance -
      // approximate via the same wagering-ratio model using its expected turnover.
      tier = varianceTier({ wageringMultiplier: 1, houseEdge });
    }
    if (tier && (worst == null || order.indexOf(tier) > order.indexOf(worst))) worst = tier;
  }
  return worst;
}
