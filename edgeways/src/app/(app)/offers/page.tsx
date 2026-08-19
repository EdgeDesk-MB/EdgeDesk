"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import {
  PageHeaderActions,
  PageHeaderButtonGroup,
  PageHeaderStat,
  PageHeaderStatGroup,
  pagePrimaryButtonProps,
} from "@/components/layout/page-header-actions";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import {
  groupOffersByListDay,
  isOfferActiveInList,
  isOfferEffectivelyExpired,
  isOfferInExpiredFeed,
  isOfferInMainFeed,
  startOfLocalDay,
} from "@/lib/offers/offer-list-groups";
import { FilterPill } from "@/components/ui/filter-pill";
import { filterPillCountState } from "@/lib/ui/surface-styles";
import { formatPillLabel } from "@/lib/ui/status-badges";
import { listOfferNextActions, offerNextActionLabel } from "@/lib/offers/next-actions";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { OfferCampaignCard } from "@/components/offers/offer-campaign-card";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import { useOfferDialog } from "@/components/offers/offer-provider";
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
import { ListDaySection } from "@/components/layout/list-day-section";
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
  const [category, setCategory] = useState<OfferCategoryId | "all">("all");
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

  // Only offer categories actually present - keeps the picker short instead
  // of listing all ~20 sports regardless of what's been logged.
  const availableCategories = useMemo(() => {
    const ids = new Set<OfferCategoryId>();
    for (const o of bookieScoped) ids.add(offerCategoryFromSport(o.sport));
    return OFFER_CATEGORIES.filter((c) => ids.has(c.id));
  }, [bookieScoped]);
  const showCategoryFilter = availableCategories.length > 1;
  // Falls back to "all" during render (not an effect) once the picked
  // category disappears from the data - e.g. its last offer was deleted.
  const effectiveCategory =
    showCategoryFilter && availableCategories.some((c) => c.id === category) ? category : "all";

  const categoryScoped = useMemo(() => {
    if (effectiveCategory === "all") return bookieScoped;
    return bookieScoped.filter((o) => offerCategoryFromSport(o.sport) === effectiveCategory);
  }, [bookieScoped, effectiveCategory]);

  const filtered = useMemo(() => {
    if (filter === "expired") {
      return categoryScoped.filter((o) => isOfferInExpiredFeed(o));
    }
    if (filter === "completed") {
      return categoryScoped.filter((o) => o.status === "completed");
    }
    if (filter === "needs_action") {
      return categoryScoped.filter(
        (o) => needsActionIds.has(o.id) && isOfferInMainFeed(o)
      );
    }
    if (filter === "active") {
      return categoryScoped.filter((o) => isOfferActiveInList(o));
    }
    // All — open campaigns from today onward (no expired, completed, or past windows).
    return categoryScoped.filter((o) => isOfferInMainFeed(o));
  }, [categoryScoped, filter, needsActionIds]);

  const now = useNow(60_000);
  const grouped = useMemo(() => {
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
  }, [filtered, filter, now]);

  const totals = useMemo(() => {
    return {
      active: categoryScoped.filter((o) => isOfferActiveInList(o)).length,
      expired: categoryScoped.filter((o) => isOfferEffectivelyExpired(o)).length,
    };
  }, [categoryScoped]);

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
    // Deferred a microtask - see tracker/page.tsx highlight handling.
    let fadeTimer: number | undefined;
    queueMicrotask(() => {
      setHighlightId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("highlight");
      const qs = params.toString();
      router.replace(qs ? `/offers?${qs}` : "/offers", { scroll: false });
      fadeTimer = window.setTimeout(() => setHighlightId(null), 2500);
    });
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
          <PageHeaderActions className="gap-6">
            <PageHeaderStatGroup>
              <PageHeaderStat label="Active">{totals.active}</PageHeaderStat>
              <PageHeaderStat label="Actions">{nextActions.length}</PageHeaderStat>
            </PageHeaderStatGroup>
            <PageHeaderButtonGroup>
              <Button {...pagePrimaryButtonProps} onClick={() => openOffer()}>
                <Plus className="size-4" /> New offer
              </Button>
            </PageHeaderButtonGroup>
          </PageHeaderActions>
        }
        toolbar={
          <>
            {(["all", "needs_action", "active", "completed", "expired"] as const).map((f) => {
              const count =
                f === "needs_action"
                  ? nextActions.length
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
            {showCategoryFilter ? (
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
            ) : null}
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
          <ListDaySection key={group.dayMs} label={group.label}>
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
          </ListDaySection>
        ))}
      </div>
    </PageShell>
  );
}
