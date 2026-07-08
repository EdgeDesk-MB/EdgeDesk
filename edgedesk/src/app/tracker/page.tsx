"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
import { PAGE_SHELL_CLASS, PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { EmptyState } from "@/components/help/empty-state";
import { api, useAppState } from "@/hooks/use-app-state";
import type { BetRow } from "@/lib/db/schema";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { MonthlyPnlSection } from "@/components/tracker/monthly-pnl-section";
import { BetLogTable } from "@/components/tracker/bet-log-table";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Download, NotebookPen } from "lucide-react";

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
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "pnl" ? "pnl" : "bets";
  const highlightParam = searchParams.get("highlight");
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [editingBet, setEditingBet] = useState<BetRow | null>(null);

  const { state, refresh } = useAppState(2000);
  const bets = useMemo(() => state?.bets ?? [], [state]);
  const events = useMemo(() => state?.events ?? [], [state]);
  const promoAwards = useMemo(() => state?.promoAwards ?? {}, [state]);
  const offerById = useMemo(
    () => new Map((state?.offers ?? []).map((o) => [o.id, o])),
    [state]
  );
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  useEffect(() => {
    if (!highlightParam) return;
    const id = Number(highlightParam);
    if (!Number.isFinite(id)) return;
    setHighlightId(id);
    router.replace("/tracker", { scroll: false });
    const fadeTimer = window.setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(fadeTimer);
  }, [highlightParam, router]);

  useEffect(() => {
    if (highlightId == null) return;
    if (!bets.some((b) => b.id === highlightId)) return;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`bet-row-${highlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
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
        description="Every position, linked to real events. Results settle bets automatically — enter a score once and every derived market updates."
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
              onClick={() => router.replace("/tracker", { scroll: false })}
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
          <CardTitle section>Bet log</CardTitle>
        </CardHeader>
        <CardContent>
          {bets.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No bets logged yet"
              description="Add a bet manually, push one from any calculator, or import a screenshot. Link an event and scores will settle derived markets automatically."
              action={{ label: "Open calculators", href: "/calculators" }}
              secondaryAction={{ label: "Getting started guide", href: "/help?guide=getting-started" }}
            />
          ) : (
            <BetLogTable
              bets={bets}
              events={events}
              promoAwards={promoAwards}
              offerById={offerById}
              eventById={eventById}
              highlightId={highlightId}
              onEdit={setEditingBet}
              onPatch={patchBet}
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
      <DialogContent className="max-w-sm">
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

