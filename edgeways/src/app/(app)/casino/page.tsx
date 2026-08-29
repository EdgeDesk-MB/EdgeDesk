"use client";

/**
 * Casino desk (H2/K1) - wagering-offer EV with variance honesty. EV here is
 * an expectation across many attempts, never a lock; every verdict carries a
 * variance tier and the copy never pretends a single session tracks the EV.
 * Realised casino profit counts in total P&L as the Casino bucket (separate
 * from Betting P&L), and credits the named bookie wallet on complete.
 *
 * K1: an offer is a CAMPAIGN that can carry multiple components (a
 * qualifying wager, plus one or more rewards). The log dialog itself lives
 * in CasinoLogProvider (side-nav quick action) and creates the campaign +
 * its first component; this page adds/edits/removes further components and
 * runs the campaign-level Start/Complete/Delete actions.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dices, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CasinoCampaignCard } from "@/components/casino/casino-campaign-card";
import { CasinoGameLibraryDialog } from "@/components/casino/casino-game-library-dialog";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { CASINO_CHANGED_EVENT } from "@/components/casino/casino-ui";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import {
  PageHeaderActions,
  PageHeaderButtonGroup,
  PageHeaderStat,
  PageHeaderStatGroup,
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { ListDaySection } from "@/components/layout/list-day-section";
import { PageShell } from "@/components/page-shell";
import { apiGet } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import {
  filterCasinoOffers,
  groupCasinoOffersByListDay,
  isCasinoEffectivelyExpired,
  isCasinoInMainFeed,
  startOfLocalDay,
  type CasinoListFilter,
} from "@/lib/offers/casino-list-groups";
import { formatPillLabel } from "@/lib/ui/status-badges";
import { FilterPill } from "@/components/ui/filter-pill";
import { filterPillCountState } from "@/lib/ui/surface-styles";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export default function CasinoPage() {
  const { openCasinoLog } = useCasinoLog();
  const [offers, setOffers] = useState<CasinoOfferSummary[] | null>(null);
  const [filter, setFilter] = useState<CasinoListFilter>("all");

  const load = useCallback(() => {
    apiGet<{ offers: CasinoOfferSummary[] }>("/api/casino")
      .then((r) => setOffers(r.offers))
      .catch(() => setOffers([]));
  }, []);

  useEffect(() => {
    load();
    // The global log dialog announces saves so the list stays current.
    window.addEventListener(CASINO_CHANGED_EVENT, load);
    return () => window.removeEventListener(CASINO_CHANGED_EVENT, load);
  }, [load]);

  function patchOfferInPlace(updated: CasinoOfferSummary) {
    setOffers((prev) => (prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev));
  }

  const now = useNow(60_000);

  const filtered = useMemo(
    () => (offers ? filterCasinoOffers(offers, filter, now) : []),
    [offers, filter, now]
  );

  const grouped = useMemo(() => {
    const todayMs = startOfLocalDay(now);
    if (filter === "expired" || filter === "completed") {
      return groupCasinoOffersByListDay(filtered, {
        now,
        sort: "descending",
      });
    }
    return groupCasinoOffersByListDay(filtered, {
      now,
      sort: "ascending",
      minDayMs: todayMs,
      useFeedDay: true,
    });
  }, [filtered, filter, now]);

  const totals = useMemo(() => {
    if (!offers) return { active: 0, needsAction: 0, expired: 0 };
    return {
      active: offers.filter((o) => o.status === "active" && isCasinoInMainFeed(o, now)).length,
      needsAction: filterCasinoOffers(offers, "needs_action", now).length,
      expired: offers.filter((o) => isCasinoEffectivelyExpired(o, now)).length,
    };
  }, [offers, now]);

  const emptyForFilter =
    offers != null &&
    offers.length > 0 &&
    filtered.length === 0;

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Casino Campaigns"
        description="Wagering offers and expected value."
        helpId="casino"
        icon={Dices}
        action={
          <PageHeaderActions className="gap-6">
            <PageHeaderStatGroup>
              <PageHeaderStat label="Active">{totals.active}</PageHeaderStat>
              <PageHeaderStat label="Actions">{totals.needsAction}</PageHeaderStat>
            </PageHeaderStatGroup>
            <PageHeaderButtonGroup>
              <CasinoGameLibraryDialog
                triggerProps={{ variant: "outline", ...pageSecondaryButtonProps }}
              />
              <Button {...pagePrimaryButtonProps} onClick={openCasinoLog}>
                <Plus className="size-4" /> Log offer
              </Button>
            </PageHeaderButtonGroup>
          </PageHeaderActions>
        }
        toolbar={
          <>
            {(["all", "needs_action", "active", "completed", "expired"] as const).map((f) => {
              const count =
                f === "needs_action"
                  ? totals.needsAction
                  : f === "expired"
                    ? totals.expired
                    : 0;
              const hasCount = count > 0;
              return (
                <FilterPill
                  key={f}
                  active={filter === f}
                  onClick={() => setFilter(f)}
                  hasCount={hasCount}
                >
                  {formatPillLabel(f)}
                  {hasCount ? (
                    <span className={filterPillCountState(filter === f)}>{count}</span>
                  ) : null}
                </FilterPill>
              );
            })}
          </>
        }
      />

      <div className="flex flex-col gap-8 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {offers == null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Dices}
            title="No casino offers yet"
            description="Log a wagering offer to get its EV verdict - each step (qualifying wager, bonus, free spins, golden chips or cashback) is priced honestly and summed to a campaign total."
          />
        ) : emptyForFilter ? (
          <EmptyState
            icon={Dices}
            title={
              filter === "completed"
                ? "No completed campaigns"
                : filter === "expired"
                  ? "No expired campaigns"
                  : filter === "active"
                    ? "No active campaigns"
                    : filter === "needs_action"
                      ? "Nothing needs action"
                      : "No open campaigns"
            }
            description={
              filter === "completed" || filter === "expired"
                ? "Switch to All to see open campaigns."
                : "Log a new offer, or check Completed / Expired."
            }
            action={
              filter === "all" || filter === "needs_action" || filter === "active"
                ? { label: "Log offer", onClick: openCasinoLog }
                : undefined
            }
          />
        ) : (
          grouped.map((group) => (
            <ListDaySection key={group.dayMs} label={group.label}>
              {group.offers.map((offer) => (
                <CasinoCampaignCard
                  key={offer.id}
                  offer={offer}
                  onChanged={patchOfferInPlace}
                  onRemoved={load}
                />
              ))}
            </ListDaySection>
          ))
        )}
      </div>
    </PageShell>
  );
}
