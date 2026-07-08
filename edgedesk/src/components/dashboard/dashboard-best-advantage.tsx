"use client";

import Link from "next/link";
import { MoneyFlow } from "@/components/money-flow";
import { bestOfferAdvantage } from "@/lib/offers/advantage";
import { offerNextActionLabel } from "@/lib/offers/next-actions";
import type { OfferSummary } from "@/lib/services/offers";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";

export function DashboardBestAdvantage({
  offers,
  className,
}: {
  offers: OfferSummary[];
  className?: string;
}) {
  const best = bestOfferAdvantage(offers);
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
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Best next
            </span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
              {actionLabel}
            </span>
            {best.bookmaker ? (
              <span className="text-[11px] text-muted-foreground">{best.bookmaker}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground">
            {best.nextAction?.title ?? best.offerTitle}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {best.offerTitle} — {best.reason}
          </span>
        </span>
        {best.remainingEv > 0.01 ? (
          <span className="shrink-0 text-right">
            <span className="block text-[10px] uppercase text-muted-foreground">Est. edge</span>
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
