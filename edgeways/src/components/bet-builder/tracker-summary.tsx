"use client";

import { BetBuilderSelectionsList } from "@/components/bet-builder/selections-list";
import { accaFoldNameFromResults } from "@/lib/bets/acca-fold-name";
import type { BetBuilderRunRow, BetBuilderSelectionRow } from "@/lib/db/schema";
import { deskTrackerSummaryBand } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Compact Profit Tracker summary of a Bet Builder (links into the desk). */
export function BetBuilderTrackerSummary({
  run,
  selections,
}: {
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
}) {
  const allResolved = selections.every((s) => s.result !== "pending");
  const method = run.method === "no_lay" ? "No lay" : "Combined lay";
  const laid = run.wholeLayBetId != null;
  const foldName = accaFoldNameFromResults(selections);

  return (
    <div className={cn(deskTrackerSummaryBand, "px-4 py-3")}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          Bet Builder Desk
          {foldName ? ` · ${foldName}` : ""}
          {laid ? " · laid" : run.method === "no_lay" ? " · no lay" : ""}
        </p>
        <a
          href="/bet-builder"
          className="text-xs font-medium text-primary-text hover:underline"
        >
          Open Bet Builder Desk
        </a>
      </div>
      <p className="mb-1.5 text-xs text-muted-foreground">
        {[run.eventLabel, method].filter(Boolean).join(" · ")}
      </p>
      <BetBuilderSelectionsList
        selections={selections}
        stage={
          !allResolved
            ? run.method === "no_lay"
              ? "awaiting result"
              : laid
                ? "awaiting result"
                : "awaiting combined lay"
            : null
        }
      />
    </div>
  );
}
