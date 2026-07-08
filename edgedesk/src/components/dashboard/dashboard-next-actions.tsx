"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import {
  listOfferNextActions,
  offerNextActionLabel,
  type OfferNextAction,
} from "@/lib/offers/next-actions";
import type { OfferSummary } from "@/lib/services/offers";
import { cn } from "@/lib/utils";
import { ArrowRight, Gift, ListChecks } from "lucide-react";

function actionTone(kind: OfferNextAction["kind"]): string {
  switch (kind) {
    case "convert_free_bet":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "review_expiry":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "finish_conversion":
    case "place_qualifying":
    case "start_planned":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-border/60 bg-selection-subtle text-muted-foreground";
  }
}

export function DashboardNextActions({
  offers,
  className,
}: {
  offers: OfferSummary[];
  className?: string;
}) {
  const actions = listOfferNextActions(offers).slice(0, 5);
  if (actions.length === 0) return null;

  return (
    <section
      className={cn(
        "shrink-0 border-b border-border/60",
        className
      )}
    >
      <DashboardSectionHeader
        icon={ListChecks}
        title="Next actions"
        description="What to do next across your open offers."
        action={
          <Link
            href="/offers"
            className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            All offers →
          </Link>
        }
      />
      <ul className="flex flex-col gap-1.5 px-[var(--layout-card-x)] pb-3 pt-1">
        {actions.map((action) => (
          <li key={`${action.offerId}-${action.kind}`}>
            <Link
              href={action.href}
              className="group flex items-start gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-selection-subtle"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
                  actionTone(action.kind)
                )}
              >
                <Gift className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                    {offerNextActionLabel(action.kind)}
                  </Badge>
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {action.title}
                  </span>
                  {action.bookmaker ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                      {action.bookmaker}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {action.offerTitle} — {action.detail}
                </span>
              </span>
              <ArrowRight
                className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
