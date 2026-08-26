"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { NumFlow } from "@/components/money-flow";
import { EXCHANGE_PRESETS } from "@/lib/brands/exchanges";
import { liveOddsFlash, type LiveMatchBackTag } from "@/lib/events/live-match-backs";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { oddsCellClass, oddsCellStyle } from "@/lib/ui/odds-cell";
import { cn } from "@/lib/utils";

const BETFAIR_BACK =
  EXCHANGE_PRESETS.find((preset) => preset.name === "Betfair")?.backColor ?? "#a6d8ff";

const FLASH_MS = 3000;

function useOddsFlash(
  odds: number,
  paused: boolean,
  quoteSeq: number
): {
  flash: "up" | "down" | null;
  trend: "up" | "down" | null;
} {
  const prev = useRef<number | undefined>(undefined);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (paused) {
      prev.current = odds;
      setFlash(null);
      return;
    }
    const dir = liveOddsFlash(prev.current, odds);
    prev.current = odds;
    if (!dir) {
      setTrend(null);
      setFlash(null);
      return;
    }
    setTrend(dir);
    setFlash(null);
    const frame = window.requestAnimationFrame(() => setFlash(dir));
    const clear = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [odds, paused, quoteSeq]);

  return { flash, trend };
}

function LiveBackOdds({
  odds,
  paused,
  quoteSeq,
}: {
  odds: number;
  paused: boolean;
  quoteSeq: number;
}) {
  const { flash, trend } = useOddsFlash(odds, paused, quoteSeq);
  const Icon = trend === "up" ? ChevronUp : trend === "down" ? ChevronDown : null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <NumFlow
        value={odds}
        className={cn(
          "font-semibold",
          flash === "up" && "live-odds-flash-up",
          flash === "down" && "live-odds-flash-down"
        )}
      />
      {Icon ? (
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
      ) : null}
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

  return (
    <div className={cn("flex min-w-0 flex-col items-end gap-0.5", className)}>
      {tags.length > 0 ? (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center justify-end gap-1.5",
            suspended && "opacity-60"
          )}
        >
          {tags.map((tag) => {
            const price = formatDecimalOdds(tag.odds);
            return (
              <span
                key={tag.runner}
                style={oddsCellStyle(BETFAIR_BACK)}
                aria-label={
                  suspended ? `${tag.label} ${price}, market suspended` : `${tag.label} ${price}`
                }
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
      ) : null}
      {suspended ? (
        <span className="text-xs text-muted-foreground">Market suspended</span>
      ) : null}
    </div>
  );
}
