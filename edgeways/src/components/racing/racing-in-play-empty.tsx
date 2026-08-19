"use client";

import { useEffect, useState } from "react";
import { Timer, X } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { formatRaceOffClock } from "@/lib/racing-desk/in-play";
import { emptyStateCopyInset, emptyStateIconWell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function RacingInPlayEmpty({
  startTime,
  onShowRacecard,
  className,
}: {
  /** Advertised off time (epoch ms). */
  startTime: number;
  onShowRacecard: () => void;
  className?: string;
}) {
  const now = useNow(1000);
  const { signed, phase } = formatRaceOffClock(startTime, now);
  const elapsed = phase === "elapsed";
  // Announce phase changes only, never each ticking second.
  const [phaseAnnounce, setPhaseAnnounce] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      setPhaseAnnounce(
        phase === "elapsed"
          ? "Advertised off has passed. Elapsed timer running."
          : "Countdown to advertised off."
      );
    });
  }, [phase]);

  return (
    <div className={cn("relative border-t border-border/60", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onShowRacecard}
        className="absolute right-3 top-3 size-7 text-muted-foreground"
        aria-label="Show racecard"
      >
        <X className="size-3.5" />
      </Button>
      <div
        className={cn(
          "flex flex-col items-center gap-4 py-10 text-center",
          emptyStateCopyInset
        )}
      >
        <div className={emptyStateIconWell}>
          <Timer className="size-5" aria-hidden />
        </div>
        <div className="w-full min-w-0 space-y-2">
          <p
            className={cn(
              "font-heading text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl",
              // Elapsed clock — desk --negative (brick, not neon alarm).
              elapsed ? "text-negative" : "text-foreground"
            )}
            aria-hidden
          >
            {signed}
          </p>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {phaseAnnounce}
          </p>
          <p className="text-base font-semibold">Race is off</p>
          <p className="text-sm text-muted-foreground">
            Awaiting result. If the race is delayed, show the racecard to keep working.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
          <Button {...pagePrimaryButtonProps} onClick={onShowRacecard}>
            Show racecard
          </Button>
        </div>
      </div>
    </div>
  );
}
