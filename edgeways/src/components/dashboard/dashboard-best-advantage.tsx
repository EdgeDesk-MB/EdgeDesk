"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MoneyFlow } from "@/components/money-flow";
import { bestOfferAdvantage } from "@/lib/offers/advantage";
import { useNow } from "@/hooks/use-now";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { offerNextActionLabel } from "@/lib/offers/next-actions";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { AccountBalance } from "@/lib/services/balances.types";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { VenueBadge } from "@/components/venue-badge";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";

export function DashboardBestAdvantage({
  offers,
  accounts,
  retention,
  className,
}: {
  offers: OfferSummary[];
  accounts?: AccountBalance[];
  retention?: { rate: number; sampleSize: number };
  className?: string;
}) {
  const scoped = useMemo(() => {
    const available = availableBookieNames(accounts ?? []);
    if (available.size === 0) return offers;
    return offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, available));
  }, [offers, accounts]);

  const now = useNow(60_000);
  const retentionOpts = retention
    ? { retention: retention.rate, retentionSampleSize: retention.sampleSize }
    : undefined;
  const best = bestOfferAdvantage(scoped, now, retentionOpts);
  if (!best || best.score < 0.5) return null;

  const href = best.nextAction?.href ?? `/offers?highlight=${best.offerId}`;
  const actionLabel = best.nextAction
    ? offerNextActionLabel(best.nextAction.kind)
    : "Review";

  return (
    <div
      className={cn(
        "shrink-0 border-b border-border/60 px-[var(--layout-page-x)] py-[var(--layout-section-y)]",
        className
      )}
    >
      <Link
        href={href}
        className="group flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 transition-colors hover:border-primary/40 hover:bg-primary/10"
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary-text">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            {best.bookmaker ? <VenueBadge name={best.bookmaker} /> : null}
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary-text">
              Best next
            </span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-text">
              {actionLabel}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground">
            {best.nextAction?.title ?? best.offerTitle}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {best.offerTitle} - {best.reason}
          </span>
        </span>
        {best.remainingEv > 0.01 ? (
          <span className="shrink-0 text-right">
            <EvBasisBadge basis={best.basis} className="mb-0.5 justify-end" />
            <MoneyFlow
              value={best.remainingEv}
              signColor
              signDisplay
              className="text-sm font-bold"
            />
          </span>
        ) : null}
        <ArrowRight
          className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </div>
  );
}
