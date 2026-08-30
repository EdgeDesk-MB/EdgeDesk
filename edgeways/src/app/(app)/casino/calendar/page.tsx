"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLoading } from "@/components/page-loading";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { CasinoDayCalendar } from "@/components/casino/casino-day-calendar";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { CASINO_CHANGED_EVENT } from "@/components/casino/casino-ui";
import { apiGet, useAppState } from "@/hooks/use-app-state";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { FilterPill } from "@/components/ui/filter-pill";
import { filterPillCountState } from "@/lib/ui/surface-styles";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export default function CasinoCalendarPage() {
  const { state } = useAppState(4000);
  const { openCasinoLog, viewCasino } = useCasinoLog();
  const [offers, setOffers] = useState<CasinoOfferSummary[] | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);

  const load = useCallback(() => {
    apiGet<{ offers: CasinoOfferSummary[] }>("/api/casino")
      .then((r) => setOffers(r.offers))
      .catch(() => setOffers([]));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(CASINO_CHANGED_EVENT, load);
    return () => window.removeEventListener(CASINO_CHANGED_EVENT, load);
  }, [load]);

  const availableNames = useMemo(
    () => availableBookieNames(state?.balances?.accounts ?? []),
    [state?.balances?.accounts]
  );

  const bookieScoped = useMemo(() => {
    const list = offers ?? [];
    if (!availableOnly) return list;
    return list.filter((o) => offerMatchesAvailableBookies(o.casino, availableNames));
  }, [offers, availableOnly, availableNames]);

  if (offers == null) {
    return <PageLoading label="Loading casino calendar" />;
  }

  return (
    <PageShell>
      <PageHeader
        helpId="casino"
        icon={CalendarDays}
        title="Casino calendar"
        description="What expires over the next 14 days."
        action={
          <Button {...pagePrimaryButtonProps} onClick={openCasinoLog}>
            <Plus className="size-4" /> Log offer
          </Button>
        }
        toolbar={
          <FilterPill
            active={availableOnly}
            onClick={() => setAvailableOnly((v) => !v)}
            hasCount={availableNames.size > 0}
            title={
              availableNames.size === 0
                ? "Mark bookies Available in Settings to enable this filter"
                : "Hide offers at gubbed or closed bookies"
            }
          >
            Available bookies
            {availableNames.size > 0 ? (
              <span className={filterPillCountState(availableOnly)}>
                {availableNames.size}
              </span>
            ) : null}
          </FilterPill>
        }
      />

      <CasinoDayCalendar
        offers={bookieScoped}
        standalone
        onOfferClick={viewCasino}
      />
    </PageShell>
  );
}
