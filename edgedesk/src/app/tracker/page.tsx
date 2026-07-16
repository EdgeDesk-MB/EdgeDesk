"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { filterPillState } from "@/lib/ui/surface-styles";
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

  return (
    <TooltipProvider delayDuration={200}>
    <PageShell>
      <PageHeader
        helpId="tracker"
        title="Profit Tracker"
        description="Bet Desk - organise positions by queue and offer campaign. Results settle derived markets automatically."
        action={
          <>
            <Button variant="outline" {...pageSecondaryButtonProps} asChild>
              <a href="/api/export/csv?type=bets" download>
                <Download className="size-4" /> Export CSV
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
        toolbar={
          <>
            <button
              type="button"
              className={filterPillState(activeTab === "bets")}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("tab");
                const qs = params.toString();
                router.replace(qs ? `/tracker?${qs}` : "/tracker", { scroll: false });
              }}
            >
              Bet log
            </button>
            <button
              type="button"
              className={filterPillState(activeTab === "pnl")}
              onClick={() => router.replace("/tracker?tab=pnl", { scroll: false })}
            >
              Monthly P&L
            </button>
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

      {activeTab === "pnl" ? (
        <MonthlyPnlSection />
      ) : (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle section>Bet Desk</CardTitle>
              {offerFilterId != null && Number.isFinite(offerFilterId) ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
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
            <div className="flex flex-wrap gap-1.5">
              {BET_DESK_QUEUES.map((q) => {
                const count = countDeskQueue(
                  offerFilterId != null && Number.isFinite(offerFilterId)
                    ? bets.filter((b) => b.offerId === offerFilterId)
                    : bets,
                  q.id,
                  eventById
                );
                // Review chip only earns its place when quick-logged bets exist.
                if (q.id === "quick_logged" && count === 0 && deskQueue !== "quick_logged") {
                  return null;
                }
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setDeskQueue(q.id)}
                    className={cn(filterPillState(deskQueue === q.id))}
                  >
                    {q.label}
                    {q.id !== "all" ? (
                      <span className="ml-1 tabular-nums opacity-70">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {scopedBets.length === 0 ? (
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
              onLogged={() => refresh()}
            />
          )}
        </CardContent>
      </Card>
      )}
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

