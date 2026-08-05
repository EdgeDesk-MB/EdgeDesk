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
  keepFirstRecurringInstance,
  sortDoNextItems,
  type DoNextItem,
  type DoNextSort,
} from "@/lib/offers/do-next";
import type { OfferSummary } from "@/lib/services/offers.types";
import { offerCampaignCardShell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ListOrdered, Sparkles, Timer } from "lucide-react";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import type { EvBasis } from "@/lib/offers/advantage";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { beginEffort } from "@/lib/effort-timer";

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

function doNextHeaderTint(item: DoNextItem, offer?: OfferSummary): string | null {
  if (offer && isOfferExpired(offer)) return "offer-header-tint-expired";

  // Convert-free-bet cards are about the free bet still on the table, not the
  // (already realised) qualifying-leg cost baked into offer.profit.totalProfit -
  // tint those on the remaining EV like orphan free-bet cards.
  if (offer && item.kind !== "convert_free_bet") {
    const tintValue =
      Math.abs(offer.profit.totalProfit) > 0.005
        ? offer.profit.totalProfit
        : (offer.expectedProfit ?? offer.expectedFromBets);
    if (tintValue > 0.005) return "offer-header-tint-win";
    if (tintValue < -0.005) return "offer-header-tint-loss";
    return null;
  }
  if (item.remainingEv > 0.5) return "offer-header-tint-win";
  return null;
}

function DoNextCard({
  item,
  isBest,
  onConvert,
  onOpen,
  offer,
  layout = "carousel",
}: {
  item: DoNextItem;
  isBest: boolean;
  onConvert: (item: DoNextItem) => void;
  onOpen?: (item: DoNextItem) => void;
  offer?: OfferSummary;
  /** `stack` = mobile full-width vertical list; `carousel` = desktop horizontal strip */
  layout?: "carousel" | "stack";
}) {
  const headerTint = doNextHeaderTint(item, offer);

  const cardClass = cn(
    offerCampaignCardShell,
    "min-h-[148px] rounded-[20px]",
    layout === "stack"
      ? "w-full"
      : "w-[min(100%,300px)] shrink-0 snap-start"
  );

  const body = (
    <>
      <div
        className={cn(
          "flex min-h-full min-w-0 flex-1 flex-col",
          headerTint ?? "bg-card",
          isBest && "bg-primary/[0.03]"
        )}
      >
        <div className="flex items-start gap-2 px-4 pt-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {item.bookmaker ? <VenueBadge name={item.bookmaker} size="sm" /> : null}
            {/* Warning-toned gubbed / muted cooling - matches the Accounts health chips */}
            {item.health === "gubbed" ? (
              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                Gubbed
              </span>
            ) : item.health === "cooling" ? (
              <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Cooling
              </span>
            ) : null}
            {isBest ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                <Sparkles className="size-2.5" aria-hidden />
                Best
              </span>
            ) : null}
          </div>
          <DoNextEvCorner remainingEv={item.remainingEv} basis={item.basis} />
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4">
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
          {!item.edge && item.kind !== "place_qualifying" ? (
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
              <span className="text-[11px] font-medium text-primary-text opacity-70 transition-opacity group-hover:opacity-100">
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
 * Home "Do next" - calendar-style cards, best first, Priority / Edge / Rate sort.
 * Mobile: full-width vertical stack (tabs reorder that list).
 * Desktop: horizontal snap strip.
 */
export function DashboardDoNext({ className }: { className?: string }) {
  const { items: allItems, state } = useDoNextItems(5000);
  const { openAddBet } = useAddBet();
  const { viewOffer } = useOfferDialog();
  const [sort, setSort] = useState<DoNextSort>("priority");

  const stateOffers = state?.offers;
  const offers = useMemo(() => stateOffers ?? [], [stateOffers]);

  const items = useMemo(
    () => sortDoNextItems(keepFirstRecurringInstance(allItems, offers), sort).slice(0, 8),
    [allItems, offers, sort]
  );

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
    beginEffort(item.offerId, item.kind);
    viewOffer(offer);
  }

  function renderCards(layout: "carousel" | "stack") {
    return items.map((item, i) => (
      <DoNextCard
        key={item.id}
        item={item}
        isBest={i === 0}
        layout={layout}
        onConvert={onConvert}
        onOpen={onOpenCard}
        offer={
          item.offerId != null
            ? offers.find((o) => o.id === item.offerId)
            : undefined
        }
      />
    ));
  }

  if (allItems.length === 0) return null;

  return (
    <section className={cn("shrink-0 border-b border-border/60", className)}>
      <DashboardSectionHeader
        prominent
        className="bg-page"
        titleHref="/offers"
        title="Do next"
        description={
          "Best first - same cards, different sort.\n\nPriority: expiring offers and open actions first.\nEdge: highest estimated remaining EV first.\nRate: highest £/hr estimated value first."
        }
        descriptionAriaLabel="Best first. Priority sorts by urgency. Edge sorts by estimated remaining EV. Rate sorts by EV per hour of effort."
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

      {sort === "rate" ? (
        <p className="px-[var(--layout-card-x)] pt-2 text-[11px] text-muted-foreground">
          {(() => {
            const measured = Object.values(state?.effortMeasured ?? {});
            const n = measured.reduce((a, m) => a + m.sampleSize, 0);
            return n > 0
              ? `£/hr uses your measured times where available (${n} timed offer${n === 1 ? "" : "s"}).`
              : "£/hr uses estimated effort - times are measured automatically as you work offers.";
          })()}
        </p>
      ) : null}

      {/* Mobile: vertical full-width cards; sort tabs reorder this stack */}
      <div className="flex flex-col gap-3 px-[var(--layout-card-x)] py-[calc(0.75rem+12px)] sm:hidden">
        {renderCards("stack")}
      </div>

      {/* Desktop: horizontal snap strip */}
      <div className="hidden py-[calc(0.75rem+12px)] sm:block">
        <ScrollFadeEdges
          orientation="horizontal"
          dragToScroll
          springSnap
          scrollClassName={cn(
            "app-scroll-overlay overflow-x-auto overflow-y-visible",
            "snap-x snap-mandatory",
            // scroll-padding keeps snap-start aligned with card-x; actual
            // inset lives on the flex row so end padding is not clipped
            // (padding-right on overflow-x scrollports often collapses).
            "scroll-pl-[var(--layout-card-x)] scroll-pr-[var(--layout-card-x)]",
            "py-px"
          )}
        >
          <div className="flex w-max gap-3 px-[var(--layout-card-x)]">
            {renderCards("carousel")}
          </div>
        </ScrollFadeEdges>
      </div>
    </section>
  );
}
