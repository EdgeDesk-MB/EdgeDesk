"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { PageHeaderStat, pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import {
  groupOffersByListDay,
  isOfferEffectivelyExpired,
  isOfferInExpiredFeed,
  isOfferInMainFeed,
  startOfLocalDay,
} from "@/lib/offers/offer-list-groups";
import { cn } from "@/lib/utils";
import { filterPillState } from "@/lib/ui/surface-styles";
import { formatPillLabel } from "@/lib/ui/status-badges";
import { listOfferNextActions, offerNextActionLabel } from "@/lib/offers/next-actions";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { OfferCampaignCard } from "@/components/offers/offer-campaign-card";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { Gift, Plus, Tag } from "lucide-react";

export default function OffersPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        </PageShell>
      }
    >
      <OffersContent />
    </Suspense>
  );
}

function OffersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightParam = searchParams.get("highlight");
  const { state, refresh } = useAppState(4000);
  const { openOffer, viewOffer } = useOfferDialog();
  const offers = useMemo(() => state?.offers ?? [], [state]);
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "expired" | "needs_action"
  >("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const nextActions = useMemo(() => listOfferNextActions(offers), [offers]);
  const needsActionIds = useMemo(
    () => new Set(nextActions.map((a) => a.offerId)),
    [nextActions]
  );

  const availableNames = useMemo(
    () => availableBookieNames(state?.balances?.accounts ?? []),
    [state?.balances?.accounts]
  );

  const bookieScoped = useMemo(() => {
    if (!availableOnly) return offers;
    return offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, availableNames));
  }, [offers, availableOnly, availableNames]);

  const filtered = useMemo(() => {
    if (filter === "expired") {
      return bookieScoped.filter((o) => isOfferInExpiredFeed(o));
    }
    if (filter === "completed") {
      return bookieScoped.filter((o) => o.status === "completed");
    }
    if (filter === "needs_action") {
      return bookieScoped.filter(
        (o) => needsActionIds.has(o.id) && isOfferInMainFeed(o)
      );
    }
    if (filter === "active") {
      return bookieScoped.filter((o) => o.status === "active" && isOfferInMainFeed(o));
    }
    // All — open campaigns from today onward (no expired, completed, or past windows).
    return bookieScoped.filter((o) => isOfferInMainFeed(o));
  }, [bookieScoped, filter, needsActionIds]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const todayMs = startOfLocalDay(now);
    if (filter === "expired" || filter === "completed") {
      return groupOffersByListDay(filtered, {
        now,
        sort: "descending",
      });
    }
    return groupOffersByListDay(filtered, {
      now,
      sort: "ascending",
      minDayMs: todayMs,
      useFeedDay: true,
    });
  }, [filtered, filter]);

  const totals = useMemo(() => {
    return {
      active: bookieScoped.filter((o) => o.status === "active" && isOfferInMainFeed(o)).length,
      expired: bookieScoped.filter((o) => isOfferEffectivelyExpired(o)).length,
    };
  }, [bookieScoped]);

  // P1: push notifications deep-link to the campaign details modal via
  // /offers?view=<id>. The param survives until the polled offers contain
  // the id (first load can race the poll), then opens once and strips.
  const viewParam = searchParams.get("view");
  const handledViewRef = useRef<string | null>(null);
  useEffect(() => {
    if (!viewParam || handledViewRef.current === viewParam) return;
    const id = Number(viewParam);
    const offer = Number.isFinite(id) ? offers.find((o) => o.id === id) : undefined;
    if (!offer) return;
    handledViewRef.current = viewParam;
    viewOffer(offer);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    const qs = params.toString();
    router.replace(qs ? `/offers?${qs}` : "/offers", { scroll: false });
  }, [viewParam, offers, viewOffer, router, searchParams]);

  useEffect(() => {
    if (!highlightParam) return;
    const id = Number(highlightParam);
    if (!Number.isFinite(id)) return;
    setHighlightId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("highlight");
    const qs = params.toString();
    router.replace(qs ? `/offers?${qs}` : "/offers", { scroll: false });
    const fadeTimer = window.setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(fadeTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightParam, router]);

  useEffect(() => {
    if (highlightId == null) return;
    if (!offers.some((o) => o.id === highlightId)) return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`offer-card-${highlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [offers, highlightId]);

  return (
    <PageShell>
      <PageHeader
        helpId="offers"
        icon={Tag}
        title="Campaigns"
        description="Track offer campaigns, next actions, and pipeline stages. Bets auto-link when the label or trigger looks like an offer."
        action={
          <>
            <PageHeaderStat label="Active">{totals.active}</PageHeaderStat>
            <PageHeaderStat label="Actions">{nextActions.length}</PageHeaderStat>
            <Button {...pagePrimaryButtonProps} onClick={() => openOffer()}>
              <Plus className="size-4" /> New offer
            </Button>
          </>
        }
        toolbar={
          <>
            {(["all", "needs_action", "active", "completed", "expired"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(filterPillState(filter === f))}
              >
                {f === "needs_action"
                  ? `Needs action${nextActions.length ? ` (${nextActions.length})` : ""}`
                  : f === "expired"
                    ? `Expired${totals.expired ? ` (${totals.expired})` : ""}`
                    : formatPillLabel(f)}
              </button>
            ))}
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
        }
      />

      <div className="flex flex-col gap-8">
        {filtered.length === 0 && (
          <EmptyState
            icon={Gift}
            title={
              filter === "needs_action"
                ? "Nothing needs action"
                : filter === "active"
                  ? "No active offers"
                  : filter === "expired"
                    ? "No expired offers"
                    : filter === "completed"
                      ? "No completed offers"
                      : "No offers yet"
            }
            description={
              filter === "needs_action"
                ? "All open offers are waiting on results or already complete - check back after settlements."
                : filter === "active"
                  ? "Add a place-refund racing offer to unlock Intelligence on the Racing Desk, or log a general promo."
                  : filter === "expired"
                    ? "Missed races, missed matches, and time-expired campaigns will show up here."
                    : "Add an offer manually, or log a bet with a promo trigger in the tracker."
            }
            action={{
              label: "Add racing offer",
              onClick: () => openOffer({ category: "horse_racing" }),
            }}
            secondaryAction={{ label: "Offers guide", href: "/help?guide=offers" }}
          />
        )}

        {grouped.map((group) => (
          <section key={group.dayMs} className="flex flex-col">
            <div className="flex items-center gap-3 pt-1">
              <h2 className="shrink-0 text-xs font-semibold tracking-wide text-foreground">
                {group.label}
              </h2>
              <div className="h-px min-w-0 flex-1 bg-border" aria-hidden />
            </div>
            <div className="mt-3 flex flex-col gap-4.5">
              {group.offers.map((offer) => {
                const action = nextActions.find((a) => a.offerId === offer.id);
                return (
                  <OfferCampaignCard
                    key={offer.id}
                    offer={offer}
                    highlighted={highlightId === offer.id}
                    nextActionLabel={action ? offerNextActionLabel(action.kind) : null}
                    nextActionDetail={action?.detail ?? null}
                    onRefresh={refresh}
                    onView={viewOffer}
                    onEdit={(o) => openOffer({ editOffer: o })}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
