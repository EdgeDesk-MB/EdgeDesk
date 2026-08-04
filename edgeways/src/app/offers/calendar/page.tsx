"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { OfferDayCalendar } from "@/components/offers/offer-day-calendar";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useAppState } from "@/hooks/use-app-state";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OFFER_CATEGORIES,
  offerCategoryFromSport,
  type OfferCategoryId,
} from "@/lib/offers/offer-categories";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus } from "lucide-react";

export default function OfferCalendarPage() {
  const { state } = useAppState(4000);
  const { openOffer, viewOffer } = useOfferDialog();
  const [availableOnly, setAvailableOnly] = useState(false);
  const [category, setCategory] = useState<OfferCategoryId | "all">("all");

  const offers = useMemo(() => state?.offers ?? [], [state]);
  const availableNames = useMemo(
    () => availableBookieNames(state?.balances?.accounts ?? []),
    [state?.balances?.accounts]
  );

  const bookieScoped = useMemo(() => {
    if (!availableOnly) return offers;
    return offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, availableNames));
  }, [offers, availableOnly, availableNames]);

  // Only offer categories actually present - keeps the picker short instead
  // of listing all ~20 sports regardless of what's been logged.
  const availableCategories = useMemo(() => {
    const ids = new Set<OfferCategoryId>();
    for (const o of bookieScoped) ids.add(offerCategoryFromSport(o.sport));
    return OFFER_CATEGORIES.filter((c) => ids.has(c.id));
  }, [bookieScoped]);
  // The toolbar only earns its keep (and divider) once there's more than one
  // control worth showing - a lone "Available bookies" pill isn't.
  const showCategoryFilter = availableCategories.length > 1;
  // Falls back to "all" during render (not an effect) once the picked
  // category disappears from the data - e.g. its last offer was deleted.
  const effectiveCategory =
    showCategoryFilter && availableCategories.some((c) => c.id === category) ? category : "all";

  const categoryScoped = useMemo(() => {
    if (effectiveCategory === "all") return bookieScoped;
    return bookieScoped.filter((o) => offerCategoryFromSport(o.sport) === effectiveCategory);
  }, [bookieScoped, effectiveCategory]);

  return (
    <PageShell>
      <PageHeader
        helpId="offers"
        icon={CalendarDays}
        title="Offer calendar"
        description="What to do today, this week, and later - priority and expected value first."
        action={
          <Button {...pagePrimaryButtonProps} onClick={() => openOffer()}>
            <Plus className="size-4" /> New offer
          </Button>
        }
        toolbar={
          showCategoryFilter ? (
            <>
              <Select
                value={effectiveCategory}
                onValueChange={(v) => setCategory(v as OfferCategoryId | "all")}
              >
                <SelectTrigger
                  size="sm"
                  className="w-auto rounded-full border-transparent bg-transparent px-3 text-xs font-semibold text-muted-foreground hover:text-foreground data-[state=open]:bg-muted/60 data-[state=open]:text-foreground"
                >
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <OfferCategoryIcon
                          category={c.id}
                          size={14}
                          className="text-muted-foreground"
                        />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setAvailableOnly((v) => !v)}
                className={cn(filterPillState(availableOnly))}
                title={
                  availableNames.size === 0
                    ? "Mark bookies Available in Settings to enable this filter"
                    : "Hide offers at gubbed or closed bookies"
                }
              >
                Available bookies
                {availableOnly && availableNames.size > 0 ? (
                  <span className="ml-1 tabular-nums opacity-70">{availableNames.size}</span>
                ) : null}
              </button>
            </>
          ) : null
        }
      />

      <OfferDayCalendar
        offers={categoryScoped}
        standalone
        onOfferClick={viewOffer}
      />
    </PageShell>
  );
}
