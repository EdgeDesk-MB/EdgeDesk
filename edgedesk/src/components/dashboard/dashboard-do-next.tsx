"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VenueBadge } from "@/components/venue-badge";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { useAddBet } from "@/components/add-bet-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDoNextItems } from "@/hooks/use-do-next-items";
import { isOfferExpired } from "@/lib/offers/offer-inactive-ui";
import {
  doNextBarClass,
  sortDoNextItems,
  sumActionableEv,
  type DoNextItem,
  type DoNextSort,
} from "@/lib/offers/do-next";
import type { OfferSummary } from "@/lib/services/offers.types";
import { offerCalendarCardShell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ListChecks, ListOrdered, Sparkles, Timer } from "lucide-react";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import type { EvBasis } from "@/lib/offers/advantage";

/** Matches Offer calendar board cards — Est. label + amount, top-right on header tint. */
function DoNextEvCorner({ remainingEv, basis }: { remainingEv: number; basis: EvBasis }) {
  if (remainingEv <= 0.5) return null;
  const amount = remainingEv >= 10 ? remainingEv.toFixed(0) : remainingEv.toFixed(1);
  return (
    <div className="shrink-0 text-right">
      <EvBasisBadge basis={basis} className="mb-0.5 justify-end" />
      <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
        £{amount}
      </p>
    </div>
  );
}

function doNextHeaderTint(offer?: OfferSummary, remainingEv = 0): string | null {
  if (offer) {
    const isExpired = isOfferExpired(offer);
    const tintValue =
      Math.abs(offer.profit.totalProfit) > 0.005
        ? offer.profit.totalProfit
        : (offer.expectedProfit ?? offer.expectedFromBets);
    if (isExpired) return "offer-header-tint-expired";
    if (tintValue > 0.005) return "offer-header-tint-win";
    if (tintValue < -0.005) return "offer-header-tint-loss";
    return null;
  }
  if (remainingEv > 0.5) return "offer-header-tint-win";
  return null;
}

function DoNextCard({
  item,
  isBest,
  onConvert,
  onOpen,
  offer,
}: {
  item: DoNextItem;
  isBest: boolean;
  onConvert: (item: DoNextItem) => void;
  onOpen?: (item: DoNextItem) => void;
  offer?: OfferSummary;
}) {
  const headerTint = doNextHeaderTint(offer, item.remainingEv);

  const cardClass = cn(
    offerCalendarCardShell,
    "w-[min(100%,300px)] shrink-0 snap-start min-h-[148px]"
  );

  const body = (
    <>
      <div
        className={cn(
          "relative z-[2] flex min-h-full min-w-0 flex-1 flex-col",
          headerTint ?? "bg-card",
          isBest && "bg-primary/[0.03]"
        )}
      >
        <div className="flex items-start gap-2 px-3 pt-[10px]">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {item.bookmaker ? <VenueBadge name={item.bookmaker} size="sm" /> : null}
            {isBest ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                <Sparkles className="size-2.5" aria-hidden />
                Best
              </span>
            ) : null}
          </div>
          <DoNextEvCorner remainingEv={item.remainingEv} basis={item.basis} />
        </div>

        <div className="flex flex-1 flex-col px-3 pb-3">
          <p className="truncate text-base font-semibold leading-snug text-foreground">{item.title}</p>
          {item.offerTitle && item.offerTitle !== item.title ? (
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{item.offerTitle}</p>
          ) : null}
          {item.expiryLabel && item.daysLeft != null && item.daysLeft <= 2 ? (
            <p className="mt-0.5 text-[10px] font-medium tabular-nums text-rose-700 dark:text-rose-300">
              {item.expiryLabel}
            </p>
          ) : null}
          {item.funding && item.funding.short > 0 ? (
            <p className="mt-0.5 text-[10px] font-medium tabular-nums text-orange-700 dark:text-orange-300">
              £{item.funding.short.toFixed(2)} short at {item.bookmaker}
            </p>
          ) : null}
          {item.kind !== "place_qualifying" ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
          ) : null}

          <div className="mt-auto flex justify-end pt-2">
            {item.convertLot ? (
              <Button
                type="button"
                size="sm"
                variant={isBest ? "default" : "outline"}
                className="h-7 shrink-0 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvert(item);
                }}
              >
                Convert
              </Button>
            ) : onOpen && item.offerId != null ? (
              <span className="text-[11px] font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100">
                Open →
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  if (onOpen && item.offerId != null) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        className={cn(cardClass, "cursor-pointer hover:brightness-[0.98] dark:hover:brightness-110")}
      >
        {body}
      </div>
    );
  }

  return <div className={cardClass}>{body}</div>;
}

/**
 * Home "Do next" strip - calendar-style cards, best first, Priority / Edge sort.
 */
export function DashboardDoNext({ className }: { className?: string }) {
  const { items: allItems, state } = useDoNextItems(5000);
  const { openAddBet } = useAddBet();
  const { viewOffer } = useOfferDialog();
  const [sort, setSort] = useState<DoNextSort>("priority");

  const offers = state?.offers ?? [];

  const items = useMemo(
    () => sortDoNextItems(allItems, sort).slice(0, 8),
    [allItems, sort]
  );

  const evChip = useMemo(() => {
    const { total, weakestBasis } = sumActionableEv(allItems);
    if (total < 1) return null;
    const amount = total >= 10 ? total.toFixed(0) : total.toFixed(2);
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
        +£{amount}
        <EvBasisBadge basis={weakestBasis} />
      </span>
    );
  }, [allItems]);

  function onConvert(item: DoNextItem) {
    const lot = item.convertLot;
    if (!lot) return;
    openAddBet({
      betType: "free_snr",
      bookmaker: lot.accountName,
      backStake: lot.remaining,
      labelSuggestion: lot.labelSuggestion,
    });
    toast.message("Add bet opened", {
      description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
    });
  }

  function onOpenCard(item: DoNextItem) {
    if (item.offerId == null) return;
    const offer = offers.find((o) => o.id === item.offerId);
    if (!offer) return;
    viewOffer(offer);
  }

  if (allItems.length === 0) return null;

  return (
    <section className={cn("shrink-0 border-b border-border/60", className)}>
      <DashboardSectionHeader
        pageAlign
        prominent
        titleHref="/offers"
        icon={ListChecks}
        title="Do next"
        description={
          "Best first - same cards, different sort.\n\nPriority: expiring offers and open actions first.\nEdge: highest estimated remaining EV first.\nRate: highest £/hr estimated value first."
        }
        descriptionAriaLabel="Best first. Priority sorts by urgency. Edge sorts by estimated remaining EV. Rate sorts by EV per hour of effort."
        titleBadge={evChip}
        action={
          <Tabs value={sort} onValueChange={(v) => setSort(v as DoNextSort)}>
            <TabsList variant="segmented">
              <TabsTrigger value="priority">
                <ListOrdered className="size-3.5 shrink-0" aria-hidden />
                Priority
              </TabsTrigger>
              <TabsTrigger value="edge">
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                Edge
              </TabsTrigger>
              <TabsTrigger value="rate">
                <Timer className="size-3.5 shrink-0" aria-hidden />
                Rate
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="px-[var(--layout-page-x)] py-[calc(0.75rem+12px)]">
        <div
          className={cn(
            "flex gap-3 overflow-x-auto overflow-y-visible",
            "snap-x snap-mandatory",
            "px-px py-px",
            "[scrollbar-width:thin]"
          )}
        >
          {items.map((item, i) => (
            <DoNextCard
              key={item.id}
              item={item}
              isBest={i === 0}
              onConvert={onConvert}
              onOpen={onOpenCard}
              offer={
                item.offerId != null
                  ? offers.find((o) => o.id === item.offerId)
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
