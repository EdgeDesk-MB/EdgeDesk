"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { NumFlow } from "@/components/money-flow";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import { liveOddsFlash, type LiveMatchBackTag } from "@/lib/events/live-match-backs";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { oddsCellClass, oddsCellStyle } from "@/lib/ui/odds-cell";
import {
  fixtureTapeOddsStack,
  fixtureTapeScoreLine,
  fixtureTapeScoreRail,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const BETFAIR_BACK =
  EXCHANGE_PRESETS.find((preset) => preset.name === "Betfair")?.backColor ?? "#A7D8FF";

const FLASH_MS = 3000;

function useOddsFlash(
  odds: number,
  paused: boolean,
  quoteSeq: number
): {
  flash: "up" | "down" | null;
  trend: "up" | "down" | null;
} {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);
  const [prevQuote, setPrevQuote] = useState({ odds, paused, quoteSeq });

  if (
    prevQuote.odds !== odds ||
    prevQuote.paused !== paused ||
    prevQuote.quoteSeq !== quoteSeq
  ) {
    setPrevQuote({ odds, paused, quoteSeq });
    if (paused) {
      if (flash !== null) setFlash(null);
    } else {
      const dir = liveOddsFlash(prevQuote.odds, odds);
      if (trend !== dir) setTrend(dir);
      if (flash !== null) setFlash(null);
    }
  }

  useEffect(() => {
    if (paused || trend === null) return;
    const frame = window.requestAnimationFrame(() => setFlash(trend));
    const clear = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [trend, paused, quoteSeq, odds]);

  return { flash, trend };
}

function LiveBackOdds({
  odds,
  paused,
  quoteSeq,
  chevronSide = "right",
}: {
  odds: number;
  paused: boolean;
  quoteSeq: number;
  chevronSide?: "left" | "right";
}) {
  const { flash, trend } = useOddsFlash(odds, paused, quoteSeq);
  const Icon = trend === "up" ? ChevronUp : trend === "down" ? ChevronDown : null;
  const chevron = Icon ? (
    <Icon
      className={cn(
        "size-3 shrink-0",
        trend === "up" && "text-profit",
        trend === "down" && "text-negative",
        flash === "up" && "live-odds-chevron-up",
        flash === "down" && "live-odds-chevron-down"
      )}
      aria-hidden
    />
  ) : null;
  const price = (
    <NumFlow
      value={odds}
      className={cn(
        "font-semibold",
        flash === "up" && "live-odds-flash-up",
        flash === "down" && "live-odds-flash-down"
      )}
    />
  );
  return (
    <span className="inline-flex items-center gap-0.5">
      {chevronSide === "left" ? (
        <>
          {chevron}
          {price}
        </>
      ) : (
        <>
          {price}
          {chevron}
        </>
      )}
    </span>
  );
}

export function ExchangeBackTags({
  tags,
  suspended,
  quoteSeq = 0,
  className,
}: {
  tags: LiveMatchBackTag[];
  suspended?: boolean;
  quoteSeq?: number;
  className?: string;
}) {
  if (tags.length === 0 && !suspended) return null;

  const oddsRow = tags.length > 0 ? (
    <div
      className={cn(
        "col-start-1 row-start-1 flex min-w-0 flex-wrap items-center justify-end gap-1.5",
        suspended && "invisible"
      )}
      aria-hidden={suspended}
    >
      {tags.map((tag) => {
        const price = formatDecimalOdds(tag.odds);
        return (
          <span
            key={tag.runner}
            style={oddsCellStyle(BETFAIR_BACK)}
            aria-label={`${tag.label} ${price}`}
            className={cn(
              "surface-glass relative inline-flex max-w-full items-baseline gap-1 rounded-sm px-1.5 py-0.5 text-xs tabular-nums",
              oddsCellClass
            )}
          >
            <span
              className={cn(
                "max-w-[4.5rem] truncate",
                tag.highlighted
                  ? "font-semibold text-black/90 dark:text-white"
                  : "text-black/60 dark:text-white/70"
              )}
            >
              {tag.label}
            </span>
            <LiveBackOdds odds={tag.odds} paused={!!suspended} quoteSeq={quoteSeq} />
          </span>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={cn("grid min-h-6 min-w-0 justify-items-end", className)}>
      {oddsRow}
      {suspended ? (
        <div className="col-start-1 row-start-1 flex min-h-6 items-center justify-end">
          <span className="text-xs text-muted-foreground" role="status">
            Market suspended
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function validTapeBack(odds: number | undefined): odds is number {
  return typeof odds === "number" && Number.isFinite(odds) && odds > 1;
}

/** Same Betfair back cell as the fixture tape. */
export function ExchangeBackCell({
  odds,
  label,
  chevronSide = "right",
}: {
  odds: number | undefined;
  label: string;
  chevronSide?: "left" | "right";
}) {
  if (!validTapeBack(odds)) {
    return (
      <span className={cn(fixtureTapeScoreLine, "text-muted-foreground")}>–</span>
    );
  }
  const price = formatDecimalOdds(odds);
  return (
    <span className={fixtureTapeScoreLine}>
      <span
        style={oddsCellStyle(BETFAIR_BACK)}
        aria-label={`${label} ${price}`}
        className={cn(
          "surface-glass relative inline-flex h-6 items-center rounded-sm px-1.5 text-xs leading-none tabular-nums",
          oddsCellClass
        )}
      >
        <LiveBackOdds
          odds={odds}
          paused={false}
          quoteSeq={0}
          chevronSide={chevronSide}
        />
      </span>
    </span>
  );
}

/** Home / away backs stacked like the football score rail. Same Betfair cell as Home Live. */
export function ExchangeBackStack({
  homeOdds,
  awayOdds,
  homeLabel,
  awayLabel,
  className,
  chevronSide = "right",
}: {
  homeOdds?: number;
  awayOdds?: number;
  homeLabel: string;
  awayLabel: string;
  className?: string;
  chevronSide?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        fixtureTapeOddsStack,
        "justify-items-end",
        fixtureTapeScoreRail,
        className
      )}
    >
      <ExchangeBackCell
        odds={homeOdds}
        label={`${homeLabel} back`}
        chevronSide={chevronSide}
      />
      <ExchangeBackCell
        odds={awayOdds}
        label={`${awayLabel} back`}
        chevronSide={chevronSide}
      />
    </div>
  );
}
