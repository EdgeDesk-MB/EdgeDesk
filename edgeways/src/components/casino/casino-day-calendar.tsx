"use client";

/**
 * Casino offer calendar (day-split) - the Casino desk's counterpart to
 * OfferDayCalendar. Deliberately simpler: no board/agenda toggle, no
 * priority tiers, no category filter - a casino campaign only has an
 * expiry to schedule against, not a qualifying→conversion pipeline.
 */

import { useMemo } from "react";
import { VenueBadge } from "@/components/venue-badge";
import { MoneyFlow } from "@/components/money-flow";
import {
  buildCasinoCalendarDays,
  type CasinoCalendarItem,
} from "@/lib/offers/casino-offer-calendar";
import { formatOfferDaysLeftLabel } from "@/lib/offers/offer-expiry";
import {
  offerCampaignCardInteractive,
  offerCampaignCardShell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

function headerTint(offer: CasinoOfferSummary): string | null {
  if (offer.expectedEv > 0.005) return "offer-header-tint-win";
  if (offer.expectedEv < -0.005) return "offer-header-tint-loss";
  return null;
}

function CasinoCalendarItemCard({
  item,
  onOfferClick,
}: {
  item: CasinoCalendarItem;
  onOfferClick?: (offer: CasinoOfferSummary) => void;
}) {
  const { offer } = item;
  // EV tint + urgency colour only for today / tomorrow expiries.
  const nearTerm = item.urgency === "today" || item.urgency === "tomorrow";
  const tint = nearTerm ? headerTint(offer) : null;
  const urgencyClass =
    item.urgency === "today"
      ? "text-rose-700 dark:text-rose-300"
      : item.urgency === "tomorrow"
        ? "text-orange-600 dark:text-orange-400"
        : "text-muted-foreground";

  return (
    <button
      type="button"
      onClick={() => onOfferClick?.(offer)}
      className={cn(offerCampaignCardShell, offerCampaignCardInteractive, "w-full")}
      aria-label={`View campaign: ${offer.title}`}
    >
      <div className={cn("relative z-[2] min-w-0 flex-1 px-3 pt-[10px] pb-2.5", tint ?? "bg-card")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {offer.casino ? <VenueBadge name={offer.casino} kind="bookie" size="sm" /> : null}
            <p className="mt-1 break-words text-sm font-bold leading-snug">{offer.title}</p>
            <p className={cn("mt-0.5 text-[11px] font-medium tabular-nums", urgencyClass)}>
              {formatOfferDaysLeftLabel(item.daysLeft)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              EV
            </p>
            <MoneyFlow value={offer.expectedEv} signColor estimate className="text-sm font-bold tabular-nums" />
          </div>
        </div>
      </div>
    </button>
  );
}

export function CasinoDayCalendar({
  offers,
  className,
  onOfferClick,
  /** When true (standalone page), always render - empty state included. */
  standalone = false,
}: {
  offers: CasinoOfferSummary[];
  className?: string;
  onOfferClick?: (offer: CasinoOfferSummary) => void;
  standalone?: boolean;
}) {
  const days = useMemo(() => buildCasinoCalendarDays(offers, { horizonDays: 14 }), [offers]);
  const hasItems = days.length > 0;

  if (!hasItems && !standalone) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {!hasItems ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No casino offer expiries in the next 14 days.
        </p>
      ) : (
        days.map((day) => (
          <section
            key={day.dateKey}
            className="overflow-hidden rounded-lg border border-border/60"
          >
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 dark:bg-input/25">
              <h3 className="flex-1 text-xs font-bold uppercase tracking-wide text-foreground">
                {day.label}
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {day.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2 border-t border-border/50 p-2">
              {day.items.map((item) => (
                <li key={item.offerId}>
                  <CasinoCalendarItemCard item={item} onOfferClick={onOfferClick} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
