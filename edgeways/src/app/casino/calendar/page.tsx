"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { CasinoDayCalendar } from "@/components/casino/casino-day-calendar";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { apiGet, useAppState } from "@/hooks/use-app-state";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export default function CasinoCalendarPage() {
  const router = useRouter();
  const { state } = useAppState(4000);
  const { openCasinoLog } = useCasinoLog();
  const [offers, setOffers] = useState<CasinoOfferSummary[] | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);

  const load = useCallback(() => {
    apiGet<{ offers: CasinoOfferSummary[] }>("/api/casino")
      .then((r) => setOffers(r.offers))
      .catch(() => setOffers([]));
  }, []);

  useEffect(() => {
    load();
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

  return (
    <PageShell>
      <PageHeader
        helpId="casino"
        icon={CalendarDays}
        title="Casino calendar"
        description="What expires when, over the next 14 days."
        action={
          <Button {...pagePrimaryButtonProps} onClick={openCasinoLog}>
            <Plus className="size-4" /> Log offer
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

      {offers == null ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <CasinoDayCalendar
          offers={bookieScoped}
          standalone
          onOfferClick={() => router.push("/casino")}
        />
      )}
    </PageShell>
  );
}
