"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { OfferDayCalendar } from "@/components/offers/offer-day-calendar";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useAppState } from "@/hooks/use-app-state";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus } from "lucide-react";

export default function OfferCalendarPage() {
  const { state } = useAppState(4000);
  const { openOffer, viewOffer } = useOfferDialog();
  const [availableOnly, setAvailableOnly] = useState(false);

  const offers = useMemo(() => state?.offers ?? [], [state]);
  const availableNames = useMemo(
    () => availableBookieNames(state?.balances?.accounts ?? []),
    [state?.balances?.accounts]
  );

  const bookieScoped = useMemo(() => {
    if (!availableOnly) return offers;
    return offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, availableNames));
  }, [offers, availableOnly, availableNames]);

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
        }
      />

      <OfferDayCalendar
        offers={bookieScoped}
        standalone
        onOfferClick={viewOffer}
      />
    </PageShell>
  );
}
