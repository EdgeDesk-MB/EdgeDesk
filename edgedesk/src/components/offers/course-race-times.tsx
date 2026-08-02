"use client";

import { useNow } from "@/hooks/use-now";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatOfferScopeLabel,
  normalizeCourseName,
  parseScopeCourses,
} from "@/lib/offers/racing-offer-rules";

interface RacecardSlim {
  externalId: string;
  course: string;
  offTime: string;
  startTime: number;
  fieldSize: number;
  status: "upcoming" | "live" | "finished";
}

export function CourseRaceTimes({
  scopeCourse,
  eventDate,
  minRunners,
}: {
  scopeCourse: string;
  eventDate: string;
  minRunners?: number | null;
}) {
  const [races, setRaces] = useState<RacecardSlim[] | null>(null);
  const scopeLabel = formatOfferScopeLabel(scopeCourse);
  const multi = parseScopeCourses(scopeCourse).length > 1;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/racing/racecards?date=${encodeURIComponent(eventDate)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const cards: RacecardSlim[] = data.racecards ?? [];
        const keys = new Set(parseScopeCourses(scopeCourse).map(normalizeCourseName));
        const matching = cards.filter((c) => keys.has(normalizeCourseName(c.course)));
        setRaces(matching.sort((a, b) => a.startTime - b.startTime));
      })
      .catch(() => {
        if (!cancelled) setRaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeCourse, eventDate]);

  const now = useNow(30_000);

  if (!races || races.length === 0) return null;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {scopeLabel} races
      </p>
      <div className="flex flex-wrap gap-1.5">
        {races.map((race) => {
          const past = race.startTime < now;
          const live = race.status === "live";
          const belowMin =
            minRunners != null && minRunners > 0 && race.fieldSize < minRunners;

          return (
            <span
              key={race.externalId}
              title={
                belowMin
                  ? `${race.course} · ${race.fieldSize} runners (need ${minRunners}+)`
                  : multi
                    ? race.course
                    : undefined
              }
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-mono tabular-nums",
                live && !belowMin
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : belowMin
                    ? "text-muted-foreground/40 line-through"
                    : past
                      ? "text-muted-foreground/50"
                      : "text-foreground"
              )}
            >
              {multi ? `${race.course} ${race.offTime}` : race.offTime}
            </span>
          );
        })}
      </div>
    </div>
  );
}
