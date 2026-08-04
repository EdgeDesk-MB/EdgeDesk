"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { PAGE_SHELL_CLASS, PageShell } from "@/components/page-shell";
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
import { BetCampaignSections } from "@/components/tracker/bet-campaign-sections";
import {
  BET_DESK_QUEUES,
  countDeskQueue,
  deskQueueEmptyCopy,
  filterBetsByDeskQueue,
  groupBetsByCampaign,
  type BetDeskQueue,
} from "@/lib/bets/desk-queues";
import { brandChipCountInverse, filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Download, NotebookPen } from "lucide-react";

function parseDeskQueue(raw: string | null): BetDeskQueue {
  if (raw && BET_DESK_QUEUES.some((q) => q.id === raw)) return raw as BetDeskQueue;
  return "all";
}

export default function TrackerPage() {
  return (
    <Suspense fallback={<div className={cn(PAGE_SHELL_CLASS, "text-sm text-muted-foreground")}>Loading…</div>}>
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
  const deskQueue = parseDeskQueue(searchParams.get("queue"));
  const offerFilterParam = searchParams.get("offer");
  const offerFilterId = offerFilterParam != null ? Number(offerFilterParam) : null;
  const highlightParam = searchParams.get("highlight");
  const actionParam = searchParams.get("action");
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [editingBet, setEditingBet] = useState<BetRow | null>(null);
  const actionApplied = useRef(false);

  const { state, refresh } = useAppState(2000);
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

  const scopedBets = useMemo(() => {
    let list = bets;
    if (offerFilterId != null && Number.isFinite(offerFilterId)) {
      list = list.filter((b) => b.offerId === offerFilterId);
    }
    return filterBetsByDeskQueue(list, deskQueue, eventById);
  }, [bets, deskQueue, offerFilterId, eventById]);

  const campaignGroups = useMemo(
    () =>
      deskQueue === "offers" || deskQueue === "all"
        ? groupBetsByCampaign(scopedBets, offerById, {
            includeOrphans: deskQueue === "all",
          })
        : [],
    [scopedBets, offerById, deskQueue]
  );

  const useCampaignView =
    (deskQueue === "offers" || deskQueue === "all") &&
    campaignGroups.some((g) => g.offerId != null);

  const queueSourceBets =
    offerFilterId != null && Number.isFinite(offerFilterId)
      ? bets.filter((b) => b.offerId === offerFilterId)
      : bets;

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
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    if (queue === "all") params.delete("queue");
    else params.set("queue", queue);
    const qs = params.toString();
    router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
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

  return (
    <TooltipProvider delayDuration={200}>
    <PageShell>
      <PageHeader
        helpId="tracker"
        title="Profit Tracker"
        description="Organise positions by queue and offer campaign. Results settle derived markets automatically."
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
            <AddBetDialog
              onSaved={() => refresh()}
              events={events}
              trigger={
                <Button {...pagePrimaryButtonProps}>
                  <Plus className="size-4" /> Add bet
                </Button>
              }
            />
          </>
        }
      />
        <AddBetDialog
          open={editingBet != null}
          onOpenChange={(open) => {
            if (!open) setEditingBet(null);
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
              <div className="flex flex-wrap gap-1.5">
                {BET_DESK_QUEUES.map((q) => {
                  const count = countDeskQueue(queueSourceBets, q.id, eventById);
                  if (q.id === "quick_logged" && count === 0 && deskQueue !== "quick_logged") {
                    return null;
                  }
                  const active = deskQueue === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setDeskQueue(q.id)}
                      className={cn(filterPillState(active))}
                    >
                      {q.label}
                      {q.id !== "all" ? (
                        <span
                          className={cn(
                            active
                              ? brandChipCountInverse
                              : "ml-0.5 tabular-nums opacity-70"
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
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
            </div>
          ) : null}
          {activeTab === "pnl" ? (
            <MonthlyPnlSection variant="plain" />
          ) : scopedBets.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title={deskQueueEmptyCopy(deskQueue).title}
              description={deskQueueEmptyCopy(deskQueue).description}
              action={{ label: "Open calculators", href: "/calculators" }}
              secondaryAction={{ label: "Offers", href: "/offers" }}
            />
          ) : useCampaignView ? (
            <BetCampaignSections
              groups={campaignGroups}
              events={events}
              promoAwards={promoAwards}
              offerById={offerById}
              eventById={eventById}
              highlightId={highlightId}
              onEdit={setEditingBet}
              onPatch={patchBet}
              onPatchEvent={patchEvent}
              onLogged={() => refresh()}
            />
          ) : (
            <BetLogTable
              bets={scopedBets}
              events={events}
              promoAwards={promoAwards}
              offerById={offerById}
              eventById={eventById}
              highlightId={highlightId}
              onEdit={setEditingBet}
              onPatch={patchBet}
              onPatchEvent={patchEvent}
              onLogged={() => refresh()}
            />
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
            This permanently deletes all {count} bet{count === 1 ? "" : "s"} in the tracker and
            removes their settlement entries from the dashboard history. This cannot be undone.
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
