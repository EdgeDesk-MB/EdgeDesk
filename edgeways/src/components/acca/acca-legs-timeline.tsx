"use client";

import { Check } from "lucide-react";
import { FlowTimeline, FlowTimelineStep, type FlowTimelineTone } from "@/components/ui/flow-timeline";
import { formatClockTime } from "@/lib/time-format";
import type { AccaLegRow, AccaRunRow, EventRow } from "@/lib/db/schema";
import { deskLegTitleParts } from "@/lib/desk/desk-leg-title";
import { isWholeComboAccaMethod } from "@/content/help/acca-methods";
import { deskTrackerSummaryBand } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function legTone(
  run: AccaRunRow,
  legs: AccaLegRow[],
  leg: AccaLegRow,
  now: number
): FlowTimelineTone {
  if (run.method === "sequential" && legs.some((l) => l.result === "lost") && leg.result === "pending") {
    return "muted";
  }
  if (leg.result === "won") return "done";
  if (leg.result === "lost") return "lost";
  if (leg.result === "void") return "muted";
  // Real lay or deliberate £0 no-lay both count as a lay decision.
  if (leg.layStake != null) return "done";

  const earlierPending = legs.some((l) => l.seq < leg.seq && l.result === "pending");
  const anyLost = legs.some((l) => l.result === "lost");
  if (
    run.status === "active" &&
    !isWholeComboAccaMethod(run.method) &&
    !earlierPending &&
    !anyLost
  ) {
    return "current";
  }
  void now;
  return "pending";
}

/** Shared leg rail for Acca Desk and Profit Tracker. */
export function AccaLegsTimeline({
  run,
  legs,
  now,
  renderLeg,
  className,
}: {
  run: AccaRunRow;
  legs: AccaLegRow[];
  now: number;
  renderLeg: (leg: AccaLegRow, tone: FlowTimelineTone) => React.ReactNode;
  className?: string;
}) {
  return (
    <FlowTimeline className={className}>
      {legs.map((leg, i) => {
        const tone = legTone(run, legs, leg, now);
        return (
          <FlowTimelineStep
            key={leg.id}
            tone={tone}
            first={i === 0}
            last={i === legs.length - 1}
          >
            {renderLeg(leg, tone)}
          </FlowTimelineStep>
        );
      })}
    </FlowTimeline>
  );
}

/** Compact tracker summary of Acca legs (links into Acca Desk). */
export function AccaTrackerLegsSummary({
  run,
  legs,
  now,
  eventById,
  /** Qualify vs convert — when omitted, generic Acca Desk heading. */
  stage,
}: {
  run: AccaRunRow;
  legs: AccaLegRow[];
  now: number;
  eventById?: Map<number, Pick<EventRow, "sport" | "homeTeam" | "awayTeam">>;
  stage?: "qualify" | "convert";
}) {
  const heading =
    stage === "convert"
      ? `Convert Acca · ${legs.length} legs`
      : stage === "qualify"
        ? `Qualify Acca · ${legs.length} legs`
        : `Acca Desk · ${legs.length} legs`;
  const statusNote =
    run.status === "completed"
      ? " · finished"
      : run.status === "active"
        ? " · in progress"
        : "";
  return (
    <div className={cn(deskTrackerSummaryBand, "px-4 py-3")}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {heading}
          <span className="font-normal text-muted-foreground">{statusNote}</span>
        </p>
        <a
          href="/acca"
          className="text-xs font-medium text-primary-text hover:underline"
        >
          Open Acca Desk
        </a>
      </div>
      <AccaLegsTimeline
        run={run}
        legs={legs}
        now={now}
        renderLeg={(leg, tone) => {
          const ev =
            leg.eventId != null ? eventById?.get(leg.eventId) ?? null : null;
          const title = deskLegTitleParts(leg, ev);
          return (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 leading-5">
              <span className="min-w-0 text-sm font-medium leading-5 text-foreground">
                <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">{leg.seq}.</span>
                {title.primary}
                {title.secondary ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {title.secondary}
                  </span>
                ) : null}
              </span>
              {leg.layStake != null ? (
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-foreground px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-background">
                  <Check className="size-3 stroke-[2.5]" aria-hidden />
                  {leg.layStake === 0 ? "No lay" : "Laid"}
                </span>
              ) : null}
              {leg.result === "pending" && leg.layStake != null ? (
                <span className="text-[11px] font-medium text-muted-foreground">
                  Awaiting result
                </span>
              ) : leg.result === "pending" && tone === "current" ? (
                <span className="text-[11px] font-medium text-primary-text">Ready to lay</span>
              ) : leg.result === "pending" ? null : (
                <span
                  className={cn(
                    "text-[11px] font-semibold capitalize",
                    tone === "done" && "text-success",
                    tone === "lost" && "text-destructive",
                    tone === "muted" && "text-muted-foreground"
                  )}
                >
                  {leg.result}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              Backed @ {leg.backOdds.toFixed(2)}
              {leg.scheduledAt
                ? ` · ${new Date(leg.scheduledAt).toLocaleDateString([], { weekday: "short" })} ${formatClockTime(leg.scheduledAt)}`
                : ""}
              {leg.layStake != null && leg.layOdds != null
                ? leg.layStake === 0
                  ? " · no lay"
                  : ` · £${leg.layStake.toFixed(2)} @ ${leg.layOdds.toFixed(2)}`
                : ""}
            </p>
          </div>
          );
        }}
      />
    </div>
  );
}
