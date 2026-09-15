"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BetBuilderSelectionRow } from "@/lib/db/schema";
import { formatBetSelection } from "@/lib/markets";

/**
 * Same-event BB selections: count bar + list (not a timeline - kick-off is shared).
 * Fold naming (Double / Treble / Four-fold) lives on the card header via ComboKindMark.
 */
export function BetBuilderSelectionsList({
  selections,
  stage,
  headerRight,
  className,
}: {
  selections: BetBuilderSelectionRow[];
  /** Optional stage after the count, e.g. "awaiting result". */
  stage?: string | null;
  /** Acca-style right slot (e.g. Void / Won / Lost for the whole ticket). */
  headerRight?: React.ReactNode;
  className?: string;
}) {
  const n = selections.length;
  const stageLabel = stage?.trim() || null;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-success/25 bg-success/5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-success/20 px-2.5 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
          {n} selection{n === 1 ? "" : "s"}
          {stageLabel ? (
            <span className="font-normal normal-case text-muted-foreground">
              {" "}
              · {stageLabel}
            </span>
          ) : null}
        </p>
        {headerRight ? <div className="ml-auto shrink-0">{headerRight}</div> : null}
      </div>
      <ul className="m-0 list-none divide-y divide-border/40 bg-card/40 p-0">
        {selections.map((sel) => (
          <li key={sel.id} className="flex min-w-0 items-start gap-3 px-2.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-5 text-foreground">
                {sel.label}
              </p>
              {sel.market || sel.selection ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    sel.market,
                    sel.selection
                      ? formatBetSelection(sel.market ?? "", sel.selection)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            {sel.result !== "pending" ? (
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 shrink-0 gap-1 text-[11px] capitalize",
                  sel.result === "won" && "border-success/30 bg-success/10 text-success",
                  sel.result === "lost" &&
                    "border-destructive/40 bg-destructive/10 text-destructive",
                  sel.result === "void" &&
                    "border-muted-foreground/30 bg-muted text-muted-foreground"
                )}
              >
                {sel.result === "won" ? (
                  <Check className="size-3 stroke-[2.5]" aria-hidden />
                ) : null}
                {sel.result}
              </Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
