"use client";

import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsLineBar, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddBetDialog } from "@/components/add-bet-dialog";
import { useAddBet } from "@/components/add-bet-provider";
import { PageShell } from "@/components/page-shell";
import { PageLoading, PlateLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { EmptyState } from "@/components/help/empty-state";
import { api, useAppState } from "@/hooks/use-app-state";
import type { BetRow } from "@/lib/db/schema";
import type { BetMode } from "@/lib/calc";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { DashboardOverviewBar } from "@/components/dashboard/dashboard-overview-bar";
import { MonthlyPnlSection } from "@/components/tracker/monthly-pnl-section";
import { BetLogTable } from "@/components/tracker/bet-log-table";
import {
  BetCampaignSections,
  type AccaRunViewLite,
  type BetBuilderRunViewLite,
  type SystemRunViewLite,
} from "@/components/tracker/bet-campaign-sections";
import { useNow } from "@/hooks/use-now";
import {
  BET_DESK_QUEUES,
  countDeskQueue,
  deskQueueEmptyCopy,
  filterBetsByDeskQueue,
  groupBetsByCampaign,
  type BetDeskQueue,
} from "@/lib/bets/desk-queues";
import {
  flattenTrackerCampaignGroups,
  groupBetsByListDay,
  groupCampaignsByListDay,
} from "@/lib/bets/tracker-list-groups";
import { ListDaySection } from "@/components/layout/list-day-section";
import { FilterPill } from "@/components/ui/filter-pill";
import { filterPillCountState } from "@/lib/ui/surface-styles";
import { Plus, Trash2, Download, NotebookPen } from "lucide-react";

/** First paint budgets for large queues (All / Offer campaigns). */
const INITIAL_CAMPAIGN_GROUPS = 6;
const INITIAL_FLAT_BETS = 50;
const MORE_FLAT_BETS = 50;

function parseDeskQueue(raw: string | null): BetDeskQueue {
  if (raw && BET_DESK_QUEUES.some((q) => q.id === raw)) return raw as BetDeskQueue;
  return "all";
}

export default function TrackerPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading Profit Tracker" />}>
      <TrackerContent />
    </Suspense>
  );
}

function TrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAddBet } = useAddBet();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "pnl" ? "pnl" : "bets";
  const urlDeskQueue = parseDeskQueue(searchParams.get("queue"));
  // Optimistic pill selection so the active queue paints before the heavy list.
  const [deskQueue, setDeskQueueState] = useState(urlDeskQueue);
  const [isQueuePending, startQueueTransition] = useTransition();
  const deferredDeskQueue = useDeferredValue(deskQueue);
  const listPending = isQueuePending || deferredDeskQueue !== deskQueue;
  const offerFilterParam = searchParams.get("offer");
  const offerFilterId = offerFilterParam != null ? Number(offerFilterParam) : null;
  const eventFilterParam = searchParams.get("event");
  const eventFilterId = eventFilterParam != null ? Number(eventFilterParam) : null;
  const highlightParam = searchParams.get("highlight");
  const actionParam = searchParams.get("action");
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [editingBet, setEditingBet] = useState<BetRow | null>(null);
  const [trackerAddOpen, setTrackerAddOpen] = useState(false);
  const [visibleCampaignGroups, setVisibleCampaignGroups] = useState(INITIAL_CAMPAIGN_GROUPS);
  const [visibleFlatBets, setVisibleFlatBets] = useState(INITIAL_FLAT_BETS);
  const [accaRuns, setAccaRuns] = useState<AccaRunViewLite[]>([]);
  const [betBuilderRuns, setBetBuilderRuns] = useState<BetBuilderRunViewLite[]>([]);
  const [systemRuns, setSystemRuns] = useState<SystemRunViewLite[]>([]);
  const [deskRunsReady, setDeskRunsReady] = useState(false);
  const [listPainted, setListPainted] = useState(false);
  const now = useNow(30_000);
  // Yield one tick on heavy queues so the spinner can paint before tables mount.
  const [listReady, setListReady] = useState(true);
  const actionApplied = useRef(false);

  const { state, refresh } = useAppState(2000);
  const deskReady = state != null;

  useEffect(() => {
    let live = true;
    Promise.all([
      api<{ runs: AccaRunViewLite[] }>("/api/acca")
        .then((r) => setAccaRuns(r.runs))
        .catch(() => setAccaRuns([])),
      api<{ runs: BetBuilderRunViewLite[] }>("/api/bet-builder")
        .then((r) => setBetBuilderRuns(r.runs ?? []))
        .catch(() => setBetBuilderRuns([])),
      api<{ runs: SystemRunViewLite[] }>("/api/systems")
        .then((r) => setSystemRuns(r.runs ?? []))
        .catch(() => setSystemRuns([])),
    ]).finally(() => {
      if (live) setDeskRunsReady(true);
    });
    return () => {
      live = false;
    };
  }, [state?.bets?.length]);

  const [prevUrlDeskQueue, setPrevUrlDeskQueue] = useState(urlDeskQueue);
  if (prevUrlDeskQueue !== urlDeskQueue) {
    setPrevUrlDeskQueue(urlDeskQueue);
    setDeskQueueState(urlDeskQueue);
  }

  const [prevListFilters, setPrevListFilters] = useState({
    queue: deferredDeskQueue,
    offer: offerFilterId,
    event: eventFilterId,
  });
  if (
    prevListFilters.queue !== deferredDeskQueue ||
    prevListFilters.offer !== offerFilterId ||
    prevListFilters.event !== eventFilterId
  ) {
    setPrevListFilters({
      queue: deferredDeskQueue,
      offer: offerFilterId,
      event: eventFilterId,
    });
    setVisibleCampaignGroups(INITIAL_CAMPAIGN_GROUPS);
    setVisibleFlatBets(INITIAL_FLAT_BETS);
  }

  const bets = useMemo(() => state?.bets ?? [], [state]);
  const events = useMemo(() => state?.events ?? [], [state]);
  const promoAwards = useMemo(() => state?.promoAwards ?? {}, [state]);
  const offerById = useMemo(
    () => new Map((state?.offers ?? []).map((o) => [o.id, o])),
    [state]
  );
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const offers = useMemo(() => state?.offers ?? [], [state]);
  const openBetCount = useMemo(
    () => bets.filter((b) => b.status === "open").length,
    [bets]
  );
  const settled = state?.settledProfit ?? 0;
  const provisional = state?.provisionalProfit ?? 0;
  const liveTotal = settled + provisional;

  const queueSourceBets = useMemo(() => {
    let list = bets;
    if (offerFilterId != null && Number.isFinite(offerFilterId)) {
      list = list.filter((b) => b.offerId === offerFilterId);
    }
    if (eventFilterId != null && Number.isFinite(eventFilterId)) {
      list = list.filter((b) => b.eventId === eventFilterId);
    }
    return list;
  }, [bets, offerFilterId, eventFilterId]);

  const queueCounts = useMemo(() => {
    const counts = {} as Record<BetDeskQueue, number>;
    for (const q of BET_DESK_QUEUES) {
      counts[q.id] = countDeskQueue(queueSourceBets, q.id, eventById);
    }
    return counts;
  }, [queueSourceBets, eventById]);

  // All / Offer campaigns (and large flat queues) are the slow mounts, paint a spinner first.
  const heavyListTarget =
    deskQueue === "all" ||
    deskQueue === "offers" ||
    (queueCounts[deskQueue] ?? 0) >= INITIAL_FLAT_BETS;

  const [prevListGate, setPrevListGate] = useState({
    pending: listPending,
    heavy: heavyListTarget,
  });
  if (prevListGate.pending !== listPending || prevListGate.heavy !== heavyListTarget) {
    setPrevListGate({ pending: listPending, heavy: heavyListTarget });
    if (!heavyListTarget) {
      setListReady(true);
    } else if (listPending) {
      setListReady(false);
    }
  }

  useEffect(() => {
    if (!heavyListTarget || listPending) return;
    const t = window.setTimeout(() => setListReady(true), 0);
    return () => clearTimeout(t);
  }, [listPending, deferredDeskQueue, heavyListTarget]);

  const showListSpinner =
    (!(deskReady && bets.length === 0) && !listPainted) ||
    (bets.length > 0 && !deskRunsReady) ||
    listPending ||
    (heavyListTarget && !listReady);

  useEffect(() => {
    if (!deskReady) {
      setListPainted(false);
      return;
    }
    if (bets.length === 0) {
      setListPainted(true);
      return;
    }
    if (listPainted) return;
    const t = window.setTimeout(() => setListPainted(true), 0);
    return () => clearTimeout(t);
  }, [deskReady, bets.length, listPainted]);

  // Heavy filter/group work follows the deferred queue so pills stay snappy.
  const scopedBets = useMemo(() => {
    let list = bets;
    if (offerFilterId != null && Number.isFinite(offerFilterId)) {
      list = list.filter((b) => b.offerId === offerFilterId);
    }
    if (eventFilterId != null && Number.isFinite(eventFilterId)) {
      list = list.filter((b) => b.eventId === eventFilterId);
    }
    return filterBetsByDeskQueue(list, deferredDeskQueue, eventById);
  }, [bets, deferredDeskQueue, offerFilterId, eventFilterId, eventById]);

  const campaignGroups = useMemo(
    () =>
      deferredDeskQueue === "offers" || deferredDeskQueue === "all"
        ? groupBetsByCampaign(scopedBets, offerById, {
            includeOrphans: deferredDeskQueue === "all",
          })
        : [],
    [scopedBets, offerById, deferredDeskQueue]
  );

  const useCampaignView =
    (deferredDeskQueue === "offers" || deferredDeskQueue === "all") &&
    campaignGroups.some((g) => g.offerId != null);

  const orderedCampaigns = useMemo(
    () => flattenTrackerCampaignGroups(groupCampaignsByListDay(campaignGroups, eventById, now)),
    [campaignGroups, eventById, now]
  );

  const visibleGroups = useMemo(() => {
    if (!useCampaignView) return orderedCampaigns;
    let limit = visibleCampaignGroups;
    if (highlightId != null) {
      const idx = orderedCampaigns.findIndex((g) => g.bets.some((b) => b.id === highlightId));
      if (idx >= 0) limit = Math.max(limit, idx + 1);
    }
    return orderedCampaigns.slice(0, limit);
  }, [orderedCampaigns, useCampaignView, visibleCampaignGroups, highlightId]);

  const visibleCampaignDays = useMemo(
    () => (useCampaignView ? groupCampaignsByListDay(visibleGroups, eventById, now) : []),
    [useCampaignView, visibleGroups, eventById, now]
  );

  const orderedFlatBets = useMemo(
    () => groupBetsByListDay(scopedBets, eventById, offerById, now).flatMap((s) => s.bets),
    [scopedBets, eventById, offerById, now]
  );

  const visibleBets = useMemo(() => {
    if (useCampaignView) return scopedBets;
    let limit = visibleFlatBets;
    if (highlightId != null) {
      const idx = orderedFlatBets.findIndex((b) => b.id === highlightId);
      if (idx >= 0) limit = Math.max(limit, idx + 1);
    }
    return orderedFlatBets.slice(0, limit);
  }, [scopedBets, orderedFlatBets, useCampaignView, visibleFlatBets, highlightId]);

  const visibleBetDays = useMemo(
    () => (useCampaignView ? [] : groupBetsByListDay(visibleBets, eventById, offerById, now)),
    [useCampaignView, visibleBets, eventById, offerById, now]
  );

  const hiddenCampaignCount = useCampaignView
    ? Math.max(0, orderedCampaigns.length - visibleGroups.length)
    : 0;
  const hiddenFlatCount = !useCampaignView
    ? Math.max(0, scopedBets.length - visibleBets.length)
    : 0;

  function setActiveTab(tab: "bets" | "pnl") {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "pnl") {
      params.set("tab", "pnl");
      params.delete("queue");
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
  }

  function setDeskQueue(queue: BetDeskQueue) {
    if (queue === deskQueue && !listPending) return;
    setDeskQueueState(queue);
    startQueueTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      if (queue === "all") params.delete("queue");
      else params.set("queue", queue);
      const qs = params.toString();
      router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
    });
  }

  useEffect(() => {
    if (!highlightParam) return;
    const id = Number(highlightParam);
    if (!Number.isFinite(id)) return;
    // Deferred a microtask: URL-driven highlight is external state, and the
    // sync-setState-in-effect render cascade is what we are avoiding.
    let fadeTimer: number | undefined;
    queueMicrotask(() => {
      setHighlightId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("highlight");
      const qs = params.toString();
      router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
      fadeTimer = window.setTimeout(() => setHighlightId(null), 2000);
    });
    return () => clearTimeout(fadeTimer);
    // Only react to highlight changes - avoid replace loops from searchParams identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightParam, router]);

  // J5: /tracker?mug=<bookie> → Add bet pre-set to a camouflage bet
  const mugParam = searchParams.get("mug");
  const mugApplied = useRef(false);
  useEffect(() => {
    if (!mugParam || mugApplied.current) return;
    mugApplied.current = true;
    openAddBet({
      mug: true,
      bookmaker: mugParam,
      labelSuggestion: `Mug bet · ${mugParam}`,
    });
    router.replace("/tracker", { scroll: false });
  }, [mugParam, openAddBet, router]);

  // Best next / Offers: /tracker?offer=&action=convert|qualify → open Add bet
  useEffect(() => {
    if (actionApplied.current) return;
    if (actionParam !== "convert" && actionParam !== "qualify") return;
    if (offerFilterId == null || !Number.isFinite(offerFilterId)) return;
    const offer = state?.offers?.find((o) => o.id === offerFilterId);
    if (!offer && state?.offers == null) return; // still loading
    actionApplied.current = true;
    const betType: BetMode = actionParam === "convert" ? "free_snr" : "qualifying";
    openAddBet({
      offerId: offerFilterId,
      betType,
      bookmaker: offer?.bookmaker ?? undefined,
      labelSuggestion:
        actionParam === "convert"
          ? `Convert FB · ${offer?.bookmaker ?? offer?.title ?? "offer"}`
          : `Qualify · ${offer?.bookmaker ?? offer?.title ?? "offer"}`,
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("action");
    const qs = params.toString();
    router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionParam, offerFilterId, state?.offers, openAddBet, router]);

  useEffect(() => {
    if (highlightId == null) return;
    if (!bets.some((b) => b.id === highlightId)) return;
    const scrollTimer = window.setTimeout(() => {
      // Two render targets: the desktop table row and the mobile card - scroll
      // whichever is actually visible (the other sits in a display:none wrapper).
      const visible = [
        document.getElementById(`bet-row-${highlightId}`),
        document.getElementById(`bet-card-${highlightId}`),
      ].find((el) => el && el.offsetParent !== null);
      visible?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [bets, highlightId]);

  async function patchBet(id: number, json: Record<string, unknown>, message: string) {
    try {
      await api(`/api/bets/${id}`, { method: "PATCH", json });
      toast.success(message);
      refresh();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  async function patchEvent(id: number, json: Record<string, unknown>, message: string) {
    try {
      await api(`/api/events/${id}`, { method: "PATCH", json });
      toast.success(message, {
        description:
          "Place-refund free bets will award if your horse finished 2nd–4th.",
      });
      refresh();
    } catch (e) {
      toast.error("Could not save result", { description: String(e) });
    }
  }

  async function clearAllBets() {
    try {
      const res = await api<{ deleted: number }>("/api/bets", { method: "DELETE" });
      toast.success(`Removed ${res.deleted} bet${res.deleted === 1 ? "" : "s"}`);
      setEditingBet(null);
      refresh();
    } catch (e) {
      toast.error("Could not clear bets", { description: String(e) });
    }
  }

  const exportHref =
    activeTab === "pnl" ? "/api/export/csv?type=monthly" : "/api/export/csv?type=bets";
  const exportLabel = activeTab === "pnl" ? "Export" : "Export CSV";

  if (!deskReady) {
    return <PageLoading label="Loading Profit Tracker" />;
  }

  return (
    <TooltipProvider delayDuration={200}>
    <PageShell>
      <PageHeader
        helpId="tracker"
        title="Profit Tracker"
        description="Open bets, grouped by day, queue and campaign."
        action={
          <>
            <Button variant="outline" {...pageSecondaryButtonProps} asChild>
              <a href={exportHref} download>
                <Download className="size-4" /> {exportLabel}
              </a>
            </Button>
            {bets.length > 0 && (
              <ClearAllBetsDialog count={bets.length} onConfirm={clearAllBets} />
            )}
            <Button {...pagePrimaryButtonProps} onClick={() => setTrackerAddOpen(true)}>
              <Plus className="size-4" /> Add bet
            </Button>
          </>
        }
      />
        {trackerAddOpen ? (
          <AddBetDialog
            open={trackerAddOpen}
            onOpenChange={setTrackerAddOpen}
            onSaved={() => refresh()}
            events={events}
          />
        ) : null}
        {editingBet != null ? (
          <AddBetDialog
            open
            onOpenChange={(next) => {
              if (!next) setEditingBet(null);
            }}
            editBet={editingBet}
            events={events}
            onSaved={() => {
              refresh();
              setEditingBet(null);
            }}
            onDeleted={() => {
              refresh();
              setEditingBet(null);
            }}
          />
        ) : null}

      {/* Homepage pace strip; breakdown tables stay on the P&L Breakdown tab. */}
      <div className="-mx-[var(--layout-page-x)]">
        <DashboardOverviewBar
          liveTotal={liveTotal}
          settled={settled}
          provisional={provisional}
          openBets={openBetCount}
          offers={offers}
          bets={bets}
          casinoSettlements={state?.casinoSettlements}
          pnlAdjustments={state?.pnlAdjustments}
          showSideSummaries={false}
        />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v === "pnl" ? "pnl" : "bets")}
            className="gap-0"
          >
            <TabsLineBar bleed="card">
              <TabsList variant="line" className="justify-start">
                <TabsTrigger value="bets">Bet log</TabsTrigger>
                <TabsTrigger value="pnl">P&L Breakdown</TabsTrigger>
              </TabsList>
            </TabsLineBar>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-4">
          {activeTab === "bets" ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5" aria-label="Bet log queues">
                {BET_DESK_QUEUES.map((q) => {
                  const count = queueCounts[q.id];
                  if (q.id === "quick_logged" && count === 0 && deskQueue !== "quick_logged") {
                    return null;
                  }
                  const active = deskQueue === q.id;
                  const hasCount = q.id !== "all";
                  return (
                    <FilterPill
                      key={q.id}
                      active={active}
                      onClick={() => setDeskQueue(q.id)}
                      hasCount={hasCount}
                    >
                      {q.label}
                      {hasCount ? (
                        <span className={filterPillCountState(active)}>{count}</span>
                      ) : null}
                    </FilterPill>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {offerFilterId != null && Number.isFinite(offerFilterId) ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-text underline-offset-2 hover:underline"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.delete("offer");
                      params.delete("action");
                      const qs = params.toString();
                      router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
                    }}
                  >
                    Clear offer filter
                  </button>
                ) : null}
                {eventFilterId != null && Number.isFinite(eventFilterId) ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-text underline-offset-2 hover:underline"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.delete("event");
                      const qs = params.toString();
                      router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
                    }}
                  >
                    Clear event filter
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {activeTab === "pnl" ? (
            <MonthlyPnlSection variant="plain" />
          ) : showListSpinner ? (
            <PlateLoading
              nested
              label="Loading bets…"
              description="Your bet log will appear here."
            />
          ) : scopedBets.length === 0 ? (
            <EmptyState
              compact
              icon={NotebookPen}
              title={deskQueueEmptyCopy(deferredDeskQueue).title}
              description={deskQueueEmptyCopy(deferredDeskQueue).description}
              action={{ label: "Open calculators", href: "/calculators" }}
              secondaryAction={{ label: "Offers", href: "/offers" }}
              className="shadow-none"
            />
          ) : useCampaignView ? (
            <>
              <div className="flex flex-col gap-8">
                {visibleCampaignDays.map((section) => (
                  <ListDaySection
                    key={section.dayMs}
                    label={section.label}
                    headingId={`tracker-day-${section.dayMs}`}
                    upcoming={section.upcoming}
                  >
                    <BetCampaignSections
                      groups={section.groups}
                      events={events}
                      promoAwards={promoAwards}
                      offerById={offerById}
                      eventById={eventById}
                      highlightId={highlightId}
                      accaRuns={accaRuns}
                      betBuilderRuns={betBuilderRuns}
                      systemRuns={systemRuns}
                      now={now}
                      onEdit={setEditingBet}
                      onPatch={patchBet}
                      onPatchEvent={patchEvent}
                      onLogged={() => refresh()}
                    />
                  </ListDaySection>
                ))}
              </div>
              {hiddenCampaignCount > 0 ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    {...pageSecondaryButtonProps}
                    onClick={() =>
                      setVisibleCampaignGroups(orderedCampaigns.length)
                    }
                  >
                    Show all campaigns
                    <span className="ml-1.5 text-muted-foreground">
                      ({hiddenCampaignCount} left)
                    </span>
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-8">
                {visibleBetDays.map((section) => {
                  const headingId = `tracker-bets-${section.dayMs}`;
                  return (
                  <ListDaySection
                    key={section.dayMs}
                    label={section.label}
                    headingId={headingId}
                    upcoming={section.upcoming}
                    contentClassName="gap-0"
                  >
                    <BetLogTable
                      bets={section.bets}
                      events={events}
                      promoAwards={promoAwards}
                      offerById={offerById}
                      eventById={eventById}
                      highlightId={highlightId}
                      labelledBy={headingId}
                      onEdit={setEditingBet}
                      onPatch={patchBet}
                      onPatchEvent={patchEvent}
                      onLogged={() => refresh()}
                    />
                  </ListDaySection>
                  );
                })}
              </div>
              {hiddenFlatCount > 0 ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    {...pageSecondaryButtonProps}
                    onClick={() => setVisibleFlatBets((n) => n + MORE_FLAT_BETS)}
                  >
                    Show more bets
                    <span className="ml-1.5 text-muted-foreground">
                      ({hiddenFlatCount} left)
                    </span>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
    </TooltipProvider>
  );
}

function ClearAllBetsDialog({
  count,
  onConfirm,
}: {
  count: number;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" {...pageSecondaryButtonProps} className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" /> Clear all
        </Button>
      </DialogTrigger>
      <DialogContent mobile="center" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Clear all bets?</DialogTitle>
          <DialogDescription>
            Delete all {count} bet{count === 1 ? "" : "s"} and their history.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            Delete all
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
