"use client";

/**
 * The Daily Plan (B1) - today's run-sheet: offer deadlines, race off times and
 * fixture kickoffs in time order, with untimed work in an "anytime" bucket.
 * Completed/impossible slots collapse (muted + strikethrough) but never
 * reorder - the sheet regenerates every poll without shuffling.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarClock } from "lucide-react";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { useDoNextItems } from "@/hooks/use-do-next-items";
import { doNextBarClass } from "@/lib/offers/do-next";
import {
  buildDailyPlan,
  mergePlanWithSeen,
  type DailyPlanSlot,
} from "@/lib/plan/daily-plan";
import { formatClockTime } from "@/lib/time-format";
import { dashboardSection } from "@/lib/ui/dashboard-layout";
import { cardInsetX } from "@/lib/ui/layout-spacing";
import { cn } from "@/lib/utils";

/** Offer slots reuse the Do Next accent palette; schedule markers stay neutral. */
function slotDotClass(slot: DailyPlanSlot): string {
  if (slot.doKind) return doNextBarClass(slot.doKind);
  return "bg-muted-foreground/60";
}

function SlotRow({ slot }: { slot: DailyPlanSlot }) {
  const timeLabel = slot.at != null ? formatClockTime(new Date(slot.at)) : "";
  const urgent = slot.priority === "critical" && !slot.done;

  const body = (
    <>
      <span
        className={cn(
          "w-12 shrink-0 text-right text-[11px] font-semibold tabular-nums",
          urgent ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground",
          slot.done && "line-through opacity-70"
        )}
      >
        {timeLabel}
      </span>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", slotDotClass(slot))}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-xs font-medium",
            slot.done && "text-muted-foreground line-through"
          )}
        >
          {slot.title}
        </span>
        {slot.detail ? (
          <span className="block truncate text-[11px] text-muted-foreground">
            {slot.detail}
          </span>
        ) : null}
      </span>
      {slot.ev != null && slot.ev > 0.5 && !slot.done ? (
        <span className="flex shrink-0 items-center gap-1.5">
          {slot.basis ? <EvBasisBadge basis={slot.basis} /> : null}
          <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            £{slot.ev >= 10 ? slot.ev.toFixed(0) : slot.ev.toFixed(1)}
          </span>
        </span>
      ) : null}
    </>
  );

  const rowClass = cn(
    "flex items-center gap-2.5 rounded-md px-2 py-1.5",
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

export function DailyPlan({ className }: { className?: string }) {
  const { items: doNext, state } = useDoNextItems(5000);
  const [slots, setSlots] = useState<DailyPlanSlot[]>([]);
  const dayKeyRef = useRef("");

  const offers = state?.offers;
  const races = state?.planRaces;
  const fixtures = state?.planFixtures;

  useEffect(() => {
    if (!state) return;
    const now = Date.now();
    const dayKey = new Date(now).toDateString();
    const fresh = buildDailyPlan({
      offers: offers ?? [],
      doNext,
      races: races ?? [],
      fixtures: fixtures ?? [],
      now,
    });
    setSlots((prev) => {
      const base = dayKeyRef.current === dayKey ? prev : [];
      dayKeyRef.current = dayKey;
      return mergePlanWithSeen(base, fresh);
    });
  }, [state, offers, doNext, races, fixtures]);

  if (slots.length === 0) return null;

  const timed = slots.filter((s) => s.at != null);
  const anytime = slots.filter((s) => s.at == null);
  const doneCount = slots.filter((s) => s.done).length;

  return (
    <section className={cn(dashboardSection, "h-auto max-h-none shrink-0", className)}>
      <DashboardSectionHeader
        prominent
        icon={CalendarClock}
        title="Today's plan"
        description="Deadlines, races and kick-offs in time order."
      />
      <div className={cn("app-scroll-nested max-h-[17.5rem] overflow-y-auto py-1.5", cardInsetX)}>
        {timed.length > 0 ? (
          <ol className="flex flex-col">
            {timed.map((slot) => (
              <li key={slot.id}>
                <SlotRow slot={slot} />
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
                "px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                timed.length > 0 && "mt-1.5 border-t border-border/60 pt-2"
              )}
            >
              Anytime
            </p>
            <ol className="flex flex-col">
              {anytime.map((slot) => (
                <li key={slot.id}>
                  <SlotRow slot={slot} />
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {doneCount > 0 ? (
          <p className="px-2 pb-1 pt-1.5 text-[10px] text-muted-foreground">
            {doneCount} of {slots.length} done
          </p>
        ) : null}
      </div>
    </section>
  );
}
