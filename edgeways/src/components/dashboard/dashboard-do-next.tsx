"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VenueBadge } from "@/components/venue-badge";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { useAddBet } from "@/components/add-bet-provider";
import { useAccaRun } from "@/components/acca-run-provider";
import { useBetBuilderRun } from "@/components/bet-builder-run-provider";
import { useScopePlaceChooser } from "@/components/scope-place-chooser-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDoNextItems } from "@/hooks/use-do-next-items";
import { beginEffort } from "@/lib/effort-timer";
import { isOfferExpired } from "@/lib/offers/offer-inactive-ui";
import {
  keepFirstRecurringInstance,
  sortDoNextItems,
  type DoNextItem,
  type DoNextSort,
} from "@/lib/offers/do-next";
import {
  deriveFreeBetLotConvertAction,
  resolveTrackBetDestination,
} from "@/lib/offers/offer-track-bet";
import type { OfferSummary } from "@/lib/services/offers.types";
import {
  convertFreeBetButtonClass,
  doNextCarouselCardWidth,
  offerCampaignCardInteractive,
  offerCampaignCardShell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ListOrdered, Sparkles, Star, Timer } from "lucide-react";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import type { EvBasis } from "@/lib/offers/advantage";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { formatEvGbp } from "@/lib/format-money";

/**
 * Matches Offer calendar board cards — Est. label + amount, top-right on header tint.
 * Keep the Est. + amount stack mounted (invisible when empty) so cards without a
 * figure do not pull the title row up relative to neighbours that show one.
 */
function DoNextEvCorner({ remainingEv, basis }: { remainingEv: number; basis: EvBasis }) {
  const show = remainingEv > 0.5;
  return (
    <div
      className={cn("shrink-0 text-right", !show && "invisible pointer-events-none")}
      aria-hidden={!show}
    >
      <EvBasisBadge basis={basis} className="mb-0.5 justify-end" />
      <p className="text-base font-bold tabular-nums text-profit">
        {show ? formatEvGbp(remainingEv) : "£0.00"}
      </p>
    </div>
  );
}

/**
 * Tint follows offer EV: Est. remaining when shown, else campaign expected.
 * Never use realised totalProfit — sunk qualifying losses paint a false loss tint
 * (e.g. Await free bet with EST. £8.50 green text but red header).
 */
function doNextHeaderTint(item: DoNextItem, offer?: OfferSummary): string | null {
  if (offer && isOfferExpired(offer)) return "offer-header-tint-expired";

  const tintValue =
    Math.abs(item.remainingEv) > 0.5
      ? item.remainingEv
      : (offer?.expectedProfit ?? offer?.expectedFromBets ?? item.remainingEv);

  if (tintValue > 0.005) return "offer-header-tint-win";
  if (tintValue < -0.005) return "offer-header-tint-loss";
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
    // Stronger glassy face than campaign default — see .do-next-card in globals.
    "do-next-card min-h-[148px] rounded-[20px]",
    layout === "stack"
      ? "w-full"
      : cn(doNextCarouselCardWidth, "shrink-0 snap-start")
  );

  const body = (
    <>
      <div
        className={cn(
          "flex min-h-full min-w-0 flex-1 flex-col",
          headerTint ?? "bg-card",
          isBest && "bg-brand/[0.03]"
        )}
      >
        <div className="flex items-start gap-2 px-4 pt-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {item.bookmaker ? <VenueBadge name={item.bookmaker} size="sm" /> : null}
            {/* Warning-toned gubbed / muted cooling - matches the Accounts health chips */}
            {item.health === "gubbed" ? (
              <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warning">
                Gubbed
              </span>
            ) : item.health === "cooling" ? (
              <span className="inline-flex items-center rounded-full border border-muted-foreground/30 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Cooling
              </span>
            ) : null}
            {isBest ? (
              <span
                className={cn(
                  // Match VenueBadge size="sm" box (incl. 1px border) exactly.
                  "do-next-best-pill inline-flex items-center gap-1 overflow-hidden rounded-full border border-transparent",
                  "bg-brand px-2 py-0.5 text-[11px] font-semibold leading-tight text-brand-foreground",
                  "shadow-[var(--ew-chip-shadow)]"
                )}
              >
                <Star className="size-2.5 shrink-0" aria-hidden />
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
            <p className="mt-0.5 text-[11px] font-medium tabular-nums text-rose-700 dark:text-rose-300">
              {item.expiryLabel}
            </p>
          ) : null}
          {item.funding && item.funding.short > 0 ? (
            <p className="mt-0.5 text-[11px] font-medium tabular-nums text-orange-700 dark:text-orange-300">
              £{item.funding.short.toFixed(2)} short at {item.bookmaker}
            </p>
          ) : null}
          {!item.edge && item.kind !== "place_qualifying" ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
          ) : null}

          <div
            className="mt-auto flex justify-end pt-2"
            data-do-next-action
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {item.convertLot ? (
              <Button
                type="button"
                size="sm"
                variant="edge"
                className={convertFreeBetButtonClass}
                onClick={() => onConvert(item)}
              >
                Convert
              </Button>
            ) : onOpen && item.offerId != null ? (
              <span className="text-xs font-medium text-primary-text opacity-70 transition-opacity group-hover:opacity-100">
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
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-do-next-action]")) return;
          onOpen(item);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
        className={cn(cardClass, offerCampaignCardInteractive)}
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
  const { openAccaRun } = useAccaRun();
  const { openBetBuilderRun } = useBetBuilderRun();
  const { openScopeChooser } = useScopePlaceChooser();
  const { viewOffer } = useOfferDialog();
  const [sort, setSort] = useState<DoNextSort>("priority");

  const stateOffers = state?.offers;
  const offers = useMemo(() => stateOffers ?? [], [stateOffers]);

  const items = useMemo(
    () => sortDoNextItems(keepFirstRecurringInstance(allItems, offers), sort).slice(0, 8),
    [allItems, offers, sort]
  );

  const measuredOfferCount = useMemo(() => {
    const measured = Object.values(state?.effortMeasured ?? {});
    return measured.reduce((a, m) => a + m.sampleSize, 0);
  }, [state?.effortMeasured]);

  const sortHelp = [
    "Priority: urgency",
    "Edge: remaining EV",
    "Rate: £/hr",
    measuredOfferCount > 0
      ? `£/hr uses your measured times where available (${measuredOfferCount} timed offer${measuredOfferCount === 1 ? "" : "s"}).`
      : "£/hr uses estimated effort. Times are measured automatically as you work offers.",
  ].join("\n");

  function onConvert(item: DoNextItem) {
    const lot = item.convertLot;
    if (!lot) return;
    const offer =
      item.offerId != null ? offers.find((o) => o.id === item.offerId) ?? null : null;
    const action = deriveFreeBetLotConvertAction(
      { remaining: lot.remaining, accountName: lot.accountName },
      offer,
      state?.settings
    );
    const opened = resolveTrackBetDestination(action, {
      openAddBet: (prefill) =>
        openAddBet({
          ...prefill,
          labelSuggestion: lot.labelSuggestion ?? prefill.labelSuggestion,
        }),
      openAccaRun,
      openBetBuilderRun,
      openScopeChooser,
    });
    if (!opened) return;
    if (action.destination.kind === "acca_desk") {
      toast.message("Acca Desk opened", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    } else if (action.destination.kind === "bet_builder_desk") {
      toast.message("Bet Builder Desk opened", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    } else if (action.destination.kind === "choose") {
      toast.message("Choose how to convert", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    } else {
      toast.message("Add bet opened", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    }
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
        description={sortHelp}
        descriptionAriaLabel="Sort Do next. Priority by urgency, Edge by remaining EV, Rate by pounds per hour."
        action={
          <Tabs
            value={sort}
            onValueChange={(v) => setSort(v as DoNextSort)}
            activationMode="manual"
          >
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

      {/* Mobile: vertical full-width cards; sort tabs reorder this stack */}
      <div className="flex flex-col gap-3 px-[var(--layout-card-x)] py-[calc(0.75rem+12px)] sm:hidden">
        {renderCards("stack")}
      </div>

      {/* Desktop: horizontal snap strip */}
      <div className="hidden py-[calc(0.75rem+12px)] sm:block">
        <ScrollFadeEdges
          orientation="horizontal"
          stepButtons
          springSnap
          pinScrollStart
          // Re-pin when the leader changes (lots/edge often prepend a convert
          // card after first paint) or the queue length settles on load.
          scrollStartKey={`${sort}:${items[0]?.id ?? ""}:${items.length}`}
          scrollClassName={cn(
            "app-scroll-overlay overflow-x-auto overflow-y-clip",
            "snap-x snap-mandatory",
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
