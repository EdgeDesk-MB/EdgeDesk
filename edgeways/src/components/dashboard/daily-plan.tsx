"use client";

/**
 * The Daily Plan (B1) - today's run-sheet: offer deadlines, race off times and
 * fixture kickoffs in time order, with untimed work in an "anytime" bucket.
 * Completed/impossible slots collapse (muted + strikethrough) but never
 * reorder - the sheet regenerates every poll without shuffling.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { useDoNextItems } from "@/hooks/use-do-next-items";
import { useNow } from "@/hooks/use-now";
import { doNextBarClass } from "@/lib/offers/do-next";
import {
  buildDailyPlan,
  mergePlanWithSeen,
  type DailyPlanSlot,
} from "@/lib/plan/daily-plan";
import { formatEvGbp } from "@/lib/format-money";
import { formatClockTime } from "@/lib/time-format";
import { EmptyState } from "@/components/help/empty-state";
import { dashboardSection } from "@/lib/ui/dashboard-layout";
import { cardInsetX } from "@/lib/ui/layout-spacing";
import { cn } from "@/lib/utils";

/** Offer slots reuse the Do Next accent palette; schedule markers stay neutral. */
function slotDotClass(slot: DailyPlanSlot): string {
  if (slot.doKind) return doNextBarClass(slot.doKind);
  return "bg-muted-foreground/60";
}

function SlotRow({
  slot,
  reserveTime,
}: {
  slot: DailyPlanSlot;
  /** Keep a time gutter so anytime dots line up with timed rows. */
  reserveTime: boolean;
}) {
  const timeLabel = slot.at != null ? formatClockTime(new Date(slot.at)) : "";
  const urgent = slot.priority === "critical" && !slot.done;
  const showTime = reserveTime || slot.at != null;

  const body = (
    <>
      {showTime ? (
        <span
          className={cn(
            "w-14 shrink-0 text-right text-sm font-semibold tabular-nums sm:w-12 sm:text-xs",
            urgent ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground",
            slot.done && "line-through opacity-70"
          )}
        >
          {timeLabel}
        </span>
      ) : null}
      <span
        className={cn("size-2 shrink-0 rounded-full sm:size-1.5", slotDotClass(slot))}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-medium sm:text-xs",
            slot.done && "text-muted-foreground line-through"
          )}
        >
          {slot.title}
        </span>
        {slot.detail ? (
          <span className="block truncate text-xs text-muted-foreground sm:text-xs">
            {slot.detail}
          </span>
        ) : null}
      </span>
      {slot.ev != null && slot.ev > 0.5 && !slot.done ? (
        <span className="flex shrink-0 items-center gap-1.5">
          {slot.basis ? <EvBasisBadge basis={slot.basis} /> : null}
          <span className="text-sm font-bold tabular-nums text-profit sm:text-xs">
            {formatEvGbp(slot.ev)}
          </span>
        </span>
      ) : null}
    </>
  );

  const rowClass = cn(
    "flex items-center gap-2.5 rounded-md py-3 sm:py-1.5",
    slot.done && "opacity-60",
    slot.href && "transition-colors hover:bg-selection-subtle"
  );

  if (slot.href) {
    return (
      <Link href={slot.href} className={rowClass}>
        {body}
      </Link>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

function PlanHeader() {
  return (
    <DashboardSectionHeader
      prominent
      className="bg-page"
      title="Today's plan"
      description="Deadlines, races and kick-offs."
    />
  );
}

export function DailyPlan({
  className,
  /** Keep the section chrome when the sheet is empty (mobile deck card). */
  keepMounted = false,
}: {
  className?: string;
  keepMounted?: boolean;
}) {
  const { items: doNext, state } = useDoNextItems(5000);
  const [slots, setSlots] = useState<DailyPlanSlot[]>([]);
  const dayKeyRef = useRef("");
  const now = useNow(60_000);

  const offers = state?.offers;
  const races = state?.planRaces;
  const fixtures = state?.planFixtures;
  const accaLegs = state?.accaLayDue;

  const sheet = useMemo(() => {
    if (!state) return null;
    return buildDailyPlan({
      offers: offers ?? [],
      doNext,
      races: races ?? [],
      fixtures: fixtures ?? [],
      accaLegs: accaLegs ?? [],
      now,
    });
  }, [state, offers, doNext, races, fixtures, accaLegs, now]);

  useEffect(() => {
    if (!sheet) return;
    const dayKey = new Date().toDateString();
    setSlots((prev) => {
      const base = dayKeyRef.current === dayKey ? prev : [];
      dayKeyRef.current = dayKey;
      return mergePlanWithSeen(base, sheet);
    });
  }, [sheet]);

  const visibleSlots = slots.length > 0 ? slots : (sheet ?? []);

  if (sheet == null) {
    if (!keepMounted) return null;
    return (
      <section
        className={cn(dashboardSection, "max-h-none shrink-0 sm:h-auto", className)}
      >
        <PlanHeader />
        <div className={cn(cardInsetX, "py-3")}>
          <EmptyState
            compact
            busy
            title="Loading today's plan"
            description="The run-sheet will appear here."
          />
        </div>
      </section>
    );
  }

  if (visibleSlots.length === 0) {
    if (!keepMounted) return null;
    return (
      <section
        className={cn(dashboardSection, "max-h-none shrink-0 sm:h-auto", className)}
      >
        <PlanHeader />
        <div className={cn(cardInsetX, "py-3")}>
          <EmptyState
            compact
            icon={CalendarClock}
            title="Nothing on the clock"
            description="Add an offer or track a race and it will land here."
            action={{ label: "Browse offers", href: "/offers" }}
          />
        </div>
      </section>
    );
  }

  const timed = visibleSlots.filter((s) => s.at != null);
  const anytime = visibleSlots.filter((s) => s.at == null);
  const doneCount = visibleSlots.filter((s) => s.done).length;

  return (
    // Mobile (deck card): fill the viewport height; desktop: natural height above the Feed.
    <section
      className={cn(dashboardSection, "max-h-none shrink-0 sm:h-auto", className)}
    >
      <PlanHeader />
      <ScrollFadeEdges
        className="min-h-0 flex-1 sm:max-h-[17.5rem] sm:flex-none"
        fadeClassName="from-page"
        scrollClassName={cn("app-scroll-nested py-1.5", cardInsetX)}
      >
        {timed.length > 0 ? (
          <ol className="flex flex-col">
            {timed.map((slot) => (
              <li key={slot.id}>
                <SlotRow slot={slot} reserveTime />
              </li>
            ))}
          </ol>
        ) : null}
        {anytime.length > 0 ? (
          <>
            <p
              role="heading"
              aria-level={3}
              className={cn(
                "pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                timed.length > 0 && "mt-1.5 border-t border-border/60 pt-2"
              )}
            >
              Anytime
            </p>
            <ol className="flex flex-col">
              {anytime.map((slot) => (
                <li key={slot.id}>
                  <SlotRow slot={slot} reserveTime={timed.length > 0} />
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {doneCount > 0 ? (
          <p className="pb-1 pt-1.5 text-[11px] text-muted-foreground">
            {doneCount} of {visibleSlots.length} done
          </p>
        ) : null}
      </ScrollFadeEdges>
    </section>
  );
}
