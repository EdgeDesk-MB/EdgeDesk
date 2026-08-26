"use client";

import { Badge } from "@/components/ui/badge";
import { effectiveEventStatus, eventShowsScore, footballClockLabel } from "@/lib/events";
import { parseRaceResults, racingEventStatusDetail } from "@/lib/racing";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

type LiveEventLike = {
  sport?: string;
  status: string;
  source?: string | null;
  startTime?: number;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  period?: string | null;
  goals?: string | null;
};

/** Right-hand status for a live or in-play tracked event - sport-aware. */
export function LiveEventStatusPanel({
  event,
  compact,
  layout = "inline",
  className,
}: {
  event: LiveEventLike;
  compact?: boolean;
  /** inline = beside title; bar = full-width status strip below title */
  layout?: "inline" | "bar";
  className?: string;
}) {
  const isRacing = event.sport === "horse_racing";
  const status = effectiveEventStatus(event);

  if (isRacing) {
    const detail = racingEventStatusDetail(event.goals);
    const raceResult = parseRaceResults(event.goals);

    return (
      <div
        className={cn(
          layout === "bar"
            ? "flex flex-wrap items-center gap-2"
            : "flex shrink-0 items-center gap-2",
          className
        )}
      >
        {status === "live" && (
          <Badge variant="active" className={cn("gap-1", compact && "text-[11px]")}>
            <Radio className="size-3 animate-pulse" />
            Off
          </Badge>
        )}
        {status === "finished" && (
          <Badge variant="secondary" className={compact ? "text-[11px]" : undefined}>
            Result
          </Badge>
        )}
        <span
          className={cn(
            layout === "bar" ? "text-xs text-muted-foreground" : "text-muted-foreground",
            compact && layout !== "bar" && "max-w-[9rem] truncate text-xs",
            !compact && layout !== "bar" && "text-sm",
            raceResult && "font-medium text-foreground"
          )}
        >
          {detail}
        </span>
      </div>
    );
  }

  const clock = footballClockLabel(event);

  return (
    <div
      className={cn(
        layout === "bar" ? "flex items-center gap-2" : "flex shrink-0 items-center gap-2",
        className
      )}
    >
      {status === "live" && clock && (
        <Badge variant="secondary" className="tabular-nums">
          {clock}
        </Badge>
      )}
      {eventShowsScore(event) ? (
        <div className={cn("font-semibold tabular-nums", compact ? "text-sm" : "text-base")}>
          {event.homeScore ?? 0}–{event.awayScore ?? 0}
        </div>
      ) : (
        <span className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          Upcoming
        </span>
      )}
    </div>
  );
}

/** Inline label for bet forms and subtitles - never football scores on racing. */
export function liveEventInlineLabel(event: LiveEventLike): string {
  if (event.sport === "horse_racing") {
    const raceResult = parseRaceResults(event.goals);
    if (raceResult) return `Result · won by ${raceResult.winner}`;
    return `Off · ${racingEventStatusDetail(event.goals).toLowerCase()}`;
  }
  if (!eventShowsScore(event)) return "Upcoming";
  const clock = footballClockLabel(event);
  const min = clock ? ` (${clock})` : "";
  return `Live · ${event.homeScore ?? 0}-${event.awayScore ?? 0}${min}`;
}
