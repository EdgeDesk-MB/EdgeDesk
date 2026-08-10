"use client";

import {
  systemStructureLabel,
  type SystemStructureType,
} from "@/lib/calc/systems-settle";
import type { EventRow, SystemLegRow, SystemRunRow } from "@/lib/db/schema";
import { deskLegTitleParts } from "@/lib/desk/desk-leg-title";
import { deskTrackerSummaryBand } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Compact Profit Tracker summary of a Systems desk ticket. */
export function SystemsTrackerSummary({
  run,
  legs,
  eventById,
}: {
  run: SystemRunRow;
  legs: SystemLegRow[];
  eventById?: Map<number, Pick<EventRow, "sport" | "homeTeam" | "awayTeam">>;
}) {
  const structureLabel = systemStructureLabel(run.structure as SystemStructureType);
  const pending = legs.filter((l) => l.result === "pending").length;

  return (
    <div className={cn(deskTrackerSummaryBand, "px-4 py-3")}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Systems Desk · {structureLabel}
          {run.eachWay ? " · EW" : ""}
        </p>
        <a
          href="/systems"
          className="text-xs font-medium text-primary-text hover:underline"
        >
          Open Systems Desk
        </a>
      </div>
      <p className="mb-1 text-xs text-muted-foreground">
        £{run.unitStake.toFixed(2)} unit · {run.lines} lines · £{run.totalStake.toFixed(2)}{" "}
        total · {run.classification.replace("_", " ")}
        {pending > 0 ? ` · ${pending} pending` : ""}
      </p>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {legs.map((leg) => {
          const title = deskLegTitleParts(
            leg,
            leg.eventId != null ? eventById?.get(leg.eventId) ?? null : null
          );
          return (
          <li key={leg.id} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {leg.seq}. {title.primary}
              {title.secondary ? (
                <span className="text-muted-foreground"> · {title.secondary}</span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums capitalize">
              @{leg.oddsDecimal.toFixed(2)} · {leg.result}
            </span>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
