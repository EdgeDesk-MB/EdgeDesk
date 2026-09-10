"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TWOUP_TIER_LABEL,
  twoupIsEdgePick,
  twoupSideTierFromPct,
  type TwoupOpennessResult,
  type TwoupOpennessTier,
  type TwoupPickSide,
} from "@/lib/calc/ep/twoup-openness";
import {
  TWOUP_TICK_SIZE,
  TWOUP_TICK_TONE,
  TWOUP_TICK_TONE_EDGE,
  edgeNavTag,
  twoupTickSlotBox,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const TICK_COUNT: Record<TwoupOpennessTier, number> = {
  skip: 1,
  thin: 2,
  ok: 3,
  strong: 4,
  unknown: 0,
};

export function TwoupFitTicks({
  tier,
  size = "list",
  loading = false,
  edge = false,
}: {
  tier: TwoupOpennessTier;
  size?: "list" | "modal";
  loading?: boolean;
  edge?: boolean;
}) {
  const filled = loading
    ? 0
    : edge && tier === "ok"
      ? 4
      : edge && tier === "strong"
        ? 5
        : TICK_COUNT[tier];
  const box = TWOUP_TICK_SIZE[size];
  const slot = twoupTickSlotBox(size);
  const tone =
    edge && (tier === "ok" || tier === "strong")
      ? TWOUP_TICK_TONE_EDGE[tier]
      : TWOUP_TICK_TONE[tier];
  return (
    <span
      className={cn(
        "flex shrink-0 items-end overflow-hidden leading-none",
        tone,
        loading && "animate-pulse motion-reduce:animate-none"
      )}
      style={{ ...slot, gap: box.gap }}
      aria-hidden
    >
      {box.heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            "block shrink-0 rounded-sm",
            !loading && index < filled ? "bg-current" : "bg-current/20"
          )}
          style={{ width: box.width, height }}
        />
      ))}
    </span>
  );
}

/** Fixed tape slot so 2UP ticks can paint without changing row height. */
export function TwoupFitTickSlot({
  size = "list",
  children,
}: {
  size?: "list" | "modal";
  children?: ReactNode;
}) {
  return (
    <span
      className="flex shrink-0 items-end overflow-hidden leading-none"
      style={twoupTickSlotBox(size)}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function TwoupEdgeMark({
  title = "2UP Edge pick",
}: {
  title?: string;
}) {
  return (
    <span className={cn(edgeNavTag, "shrink-0")} title={title}>
      Edge
    </span>
  );
}

export function twoupSideIsEdgePick(
  result: TwoupOpennessResult | null | undefined,
  side: TwoupPickSide
): boolean {
  if (result?.pick !== side) return false;
  const pct = side === "home" ? result.windfallHomePct : result.windfallAwayPct;
  return twoupIsEdgePick(twoupSideTierFromPct(pct));
}

function sideWindfallPct(
  result: TwoupOpennessResult | null | undefined,
  side: TwoupPickSide
): number | undefined {
  return side === "home" ? result?.windfallHomePct : result?.windfallAwayPct;
}

function sidePickLine(input: {
  result?: TwoupOpennessResult | null;
  side: TwoupPickSide;
  homeTeam?: string;
  awayTeam?: string;
}): string | null {
  const pct = sideWindfallPct(input.result, input.side);
  const teamName = input.side === "home" ? input.homeTeam : input.awayTeam;
  if (!teamName || pct == null) return null;
  return input.result?.pick === input.side
    ? `Take 2UP on ${teamName} (${pct}%)`
    : `${teamName} pays in ${pct}% of matches`;
}

export function twoupSideFitSummary(input: {
  result?: TwoupOpennessResult | null;
  loading?: boolean;
  side: TwoupPickSide;
  homeTeam?: string;
  awayTeam?: string;
}): string {
  if (input.loading) return "Loading 2UP take";
  const pct = sideWindfallPct(input.result, input.side);
  const tier = twoupSideTierFromPct(pct);
  const edge =
    !input.loading &&
    input.result?.pick === input.side &&
    twoupIsEdgePick(tier)
      ? "Edge pick"
      : null;
  return [edge, TWOUP_TIER_LABEL[tier], sidePickLine(input)].filter(Boolean).join(". ");
}

export function TwoupOpennessMeter({
  result,
  loading = false,
  side,
  homeTeam,
  awayTeam,
  size = "list",
}: {
  result?: TwoupOpennessResult | null;
  loading?: boolean;
  side: TwoupPickSide;
  homeTeam?: string;
  awayTeam?: string;
  size?: "list" | "modal";
}) {
  const pct = sideWindfallPct(result, side);
  const tier = twoupSideTierFromPct(pct);
  const otherName = side === "home" ? awayTeam : homeTeam;
  const isTake = result?.pick === side;
  const edge = twoupSideIsEdgePick(result, side);
  const pickLine = sidePickLine({ result, side, homeTeam, awayTeam });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none flex h-full min-h-0 w-full min-w-0 shrink-0 items-end leading-none [@media(hover:hover)_and_(pointer:fine)]:pointer-events-auto"
        >
          <TwoupFitTicks
            tier={tier}
            size={size}
            loading={loading}
            edge={edge}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-pretty break-words">
        <p className="font-medium">
          {loading ? "Loading 2UP take" : TWOUP_TIER_LABEL[tier]}
        </p>
        {!loading && pickLine ? <p className="mt-1">{pickLine}</p> : null}
        {!loading && !isTake && otherName && result?.pick && pct != null ? (
          <p className="mt-1 text-background/80">The take is on {otherName}.</p>
        ) : null}
        <p className="mt-1 text-background/80">
          {loading
            ? "Fetching this side's 2UP prices from the exchange."
            : tier === "unknown"
              ? "Need a 2UP pay rate for this side."
              : "If they go two ahead and then fail to win, the bookie pays and the lay still wins."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
