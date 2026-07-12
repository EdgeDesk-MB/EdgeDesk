"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import {
  listOfferNextActions,
  offerNextActionLabel,
  type OfferNextAction,
} from "@/lib/offers/next-actions";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AccountBalance } from "@/lib/services/balances.types";
import { VenueBadge } from "@/components/venue-badge";
import { cn } from "@/lib/utils";
import { ArrowRight, Gift, ListChecks } from "lucide-react";

function actionTone(kind: OfferNextAction["kind"]): string {
  switch (kind) {
    case "convert_free_bet":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "review_expiry":
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "place_qualifying":
    case "start_planned":
      return "border-primary/30 bg-primary/10 text-primary";
    default:
      return "border-border/60 bg-selection-subtle text-muted-foreground";
  }
}

export function DashboardNextActions({
  offers,
  accounts,
  className,
}: {
  offers: OfferSummary[];
  accounts?: AccountBalance[];
  className?: string;
}) {
  const available = useMemo(
    () => availableBookieNames(accounts ?? []),
    [accounts]
  );
  const scoped = useMemo(
    () =>
      available.size === 0
        ? offers
        : offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, available)),
    [offers, available]
  );
  const actions = listOfferNextActions(scoped).slice(0, 5);
  if (actions.length === 0) return null;

  return (
    <section
      className={cn(
        "shrink-0 border-b border-border/60",
        className
      )}
    >
      <DashboardSectionHeader
        prominent
        icon={ListChecks}
        title="Next actions"
        description="Open actions across your offers."
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
                  {action.bookmaker ? <VenueBadge name={action.bookmaker} /> : null}
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                    {offerNextActionLabel(action.kind)}
                  </Badge>
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {action.title}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {action.offerTitle} - {action.detail}
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
