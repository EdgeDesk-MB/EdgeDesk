"use client";

/**
 * Acca Desk (J7) - run acca offers as guided multi-day workflows. Three
 * methods (Sam: all in v1): sequential lock (zero-loss cover per leg,
 * final leg equalised), insurance leg-by-leg (same recursion, refund when
 * exactly one leg loses), insurance whole-acca (one combined lay). The
 * desk orchestrates; every back and lay is a REAL tracker bet.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { markUserSettledBetIds } from "@/lib/alerts/user-originated";
import { Check, ChevronDown, CircleHelp, Hourglass, Layers, Link2, Radio, Timer, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { FilterPill } from "@/components/ui/filter-pill";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { NumField } from "@/components/calc/num-field";
import { AccaLegsTimeline } from "@/components/acca/acca-legs-timeline";
import { AccaMethodHelpDialog } from "@/components/acca/method-help-dialog";
import { CreateRunDialog, EditAccaRunDialog } from "@/components/acca/create-run-dialog";
import { ExchangeFundingNotice } from "@/components/acca/exchange-funding-notice";
import { accaExchangeFundingModel } from "@/lib/acca/exchange-funding-model";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { useNow } from "@/hooks/use-now";
import type { AccaLegRow, AccaRunRow, EventRow, ExchangeRow } from "@/lib/db/schema";
import { deskLegTitleParts } from "@/lib/desk/desk-leg-title";
import {
  deskLegAutoResultNote,
  type DeskAutoResultNote,
} from "@/lib/desk/leg-auto-result-copy";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  accaAllWinEstimate,
  accaCampaignProfit,
  accaSquareProvisional,
  accaOutcomePercentages,
  applyAccaBoost,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
  wholeAccaLay,
} from "@/lib/calc/acca-workflow";
import { formatClockTime } from "@/lib/time-format";
import {
  campaignCardBadge,
  campaignFbBadge,
  campaignCardDetailsLabel,
  campaignCardDetailsSummary,
  campaignCardDetailsToggle,
  campaignCardFooterMeta,
  campaignCardHeader,
  campaignCardHeaderBlock,
  campaignCardNextAction,
  campaignCardPnl,
  campaignCardPnlLabel,
  campaignCardStakeLine,
  campaignCardTitle,
  filterPillCountState,
  filterPillGroup,
  offerCampaignCardShell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { FillSlipButton } from "@/components/fill-slip-button";
import { ComboKindMark } from "@/components/combo-kind-mark";
import { accaFoldNameFromResults } from "@/lib/bets/acca-fold-name";
import { ACCA_METHOD_HELP, isWholeComboAccaMethod } from "@/content/help/acca-methods";

function LegAutoResultNote({ note }: { note: DeskAutoResultNote }) {
  const Icon =
    note.tone === "live" ? Radio : note.tone === "armed" ? Link2 : note.tone === "due" ? Hourglass : Timer;
  const emphasize = note.tone !== "armed";
  return (
    <span
      className={cn(
        "mt-1 flex items-start gap-1.5 text-xs",
        emphasize ? "text-primary-text" : "text-muted-foreground"
      )}
      aria-live={emphasize ? "polite" : undefined}
      aria-atomic={emphasize ? true : undefined}
    >
      <Icon
        className={cn("mt-px size-3 shrink-0", note.tone === "live" && "animate-pulse")}
        aria-hidden
      />
      <span>
        <span className="font-medium">{note.title}</span>
        <span className={emphasize ? "text-muted-foreground" : undefined}>
          {" "}
          · {note.detail}
        </span>
      </span>
    </span>
  );
}

function FieldHelp({ label, children }: { label: string; children: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-label={label}
          >
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[14rem] text-xs leading-relaxed">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type RunView = { run: AccaRunRow; legs: AccaLegRow[]; backBetType: string | null };

const RESULT_CHIP: Record<AccaLegRow["result"], string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  won: "border-success/30 bg-success/10 text-success",
  lost: "border-destructive/40 bg-destructive/10 text-destructive",
  void: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const READY_CHIP = "border-primary/30 bg-primary/10 text-primary-text";
const MUTED_CHIP = "border-muted-foreground/20 text-muted-foreground/70";

function combined(legs: AccaLegRow[]): number {
  return legs.filter((l) => l.result !== "void").reduce((a, l) => a * l.backOdds, 1);
}

export default function AccaDeskPage() {
  return (
    <Suspense
      fallback={
        <PageShell className="gap-5">
          <PageHeader
            title="Acca Desk"
            description="Lay each acca leg, logged as real bets."
            helpId="acca"
            icon={Layers}
          />
          <p className="px-[var(--layout-page-x)] py-10 text-center text-sm text-muted-foreground sm:px-0">
            Loading…
          </p>
        </PageShell>
      }
    >
      <AccaDeskContent />
    </Suspense>
  );
}

function AccaDeskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "history" ? "history" : "active";
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const load = useCallback(() => {
    api<{ runs: RunView[] }>("/api/acca")
      .then((r) => setRuns(r.runs))
      .catch(() => setRuns([]));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const setTab = useCallback(
    (next: "active" | "history") => {
      router.replace(next === "history" ? "/acca?tab=history" : "/acca", { scroll: false });
    },
    [router]
  );

  const activeRuns = useMemo(() => runs?.filter((r) => r.run.status === "active") ?? [], [runs]);
  const historyRuns = useMemo(() => runs?.filter((r) => r.run.status !== "active") ?? [], [runs]);

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Acca Desk"
        description="Lay each acca leg, logged as real bets."
        helpId="acca"
        icon={Layers}
        action={<CreateRunDialog onCreated={load} />}
      />
      <div className="flex flex-col gap-3 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {runs == null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No acca runs yet"
            description="Create a run from an acca offer - sequential lock keeps every leg covered; insurance runs capture the refund when exactly one leg loses."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className={filterPillGroup} role="tablist" aria-label="Acca runs">
              {(
                [
                  { id: "active" as const, label: "Active", count: activeRuns.length },
                  { id: "history" as const, label: "History", count: historyRuns.length },
                ] as const
              ).map((q) => {
                const active = tab === q.id;
                return (
                  <FilterPill
                    key={q.id}
                    active={active}
                    hasCount
                    onClick={() => setTab(q.id)}
                  >
                    {q.label}
                    <span className={filterPillCountState(active)}>{q.count}</span>
                  </FilterPill>
                );
              })}
            </div>

            {tab === "active" ? (
              activeRuns.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="No active runs"
                  description="Every run has finished - check History, or start a new one."
                />
              ) : (
                activeRuns.map((rv) => <RunCard key={rv.run.id} view={rv} onChanged={load} />)
              )
            ) : historyRuns.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No finished runs yet"
                description="Completed acca runs move here once every leg has settled."
              />
            ) : (
              historyRuns.map((rv) => (
                <RunCard key={rv.run.id} view={rv} onChanged={load} collapsedByDefault />
              ))
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function RunCard({
  view,
  onChanged,
  collapsedByDefault = false,
}: {
  view: RunView;
  onChanged: () => void;
  /** History runs default collapsed to the headline (header + P&L + odds) - the leg-by-leg
   * table is the detail you'd study, not the number you'd read aloud (§4.2 progressive
   * disclosure convention, reused here for a desktop history list). */
  collapsedByDefault?: boolean;
}) {
  const { run, legs, backBetType } = view;
  const [detailsOpen, setDetailsOpen] = useState(!collapsedByDefault);
  const now = useNow(30_000);
  const { state } = useAppState(0);
  const { defaultExchange } = useExchanges();
  const eventById = useMemo(() => {
    const map = new Map<
      number,
      Pick<EventRow, "sport" | "homeTeam" | "awayTeam" | "status">
    >();
    for (const e of state?.events ?? []) {
      map.set(e.id, e);
    }
    return map;
  }, [state?.events]);
  const prior = priorLayLiabilities(legs);
  const rawCombinedOdds = combined(legs);
  const combinedOdds = applyAccaBoost(rawCombinedOdds, run.boostPct);
  const boosted = run.boostPct != null && run.boostPct > 0;
  const active = run.status === "active";
  const anyLost = legs.some((l) => l.result === "lost");
  const lostCount = legs.filter((l) => l.result === "lost").length;
  const refundHit =
    run.method !== "sequential" && lostCount === 1 && (run.refundAmount ?? 0) > 0;
  // Sequential lock stops laying (and the run completes) the instant one
  // leg loses - any leg still "pending" after that is moot, not awaited.
  const sequentialDead = run.method === "sequential" && anyLost;
  const bustedLeg = sequentialDead ? legs.find((l) => l.result === "lost") : undefined;
  const campaignProfit = accaCampaignProfit(
    {
      stake: run.stake,
      commission: run.commission,
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      boostPct: run.boostPct,
      backBetType,
    },
    legs
  );
  const stillOpen = active && !anyLost && legs.some((l) => l.result === "pending");
  const squareProv = stillOpen
    ? accaSquareProvisional(
        {
          stake: run.stake,
          commission: run.commission,
          method: run.method,
          wholeLayStake: run.wholeLayStake,
          wholeLayOdds: run.wholeLayOdds,
          boostPct: run.boostPct,
          backBetType,
        },
        legs.map((l) => ({
          seq: l.seq,
          backOdds: l.backOdds,
          result: l.result,
          layStake: l.layStake,
          layOdds: l.layOdds,
        }))
      )
    : null;

  async function patchRun(json: Record<string, unknown>, msg: string) {
    await api(`/api/acca/${run.id}`, { method: "PATCH", json }).catch(() => {});
    toast.success(msg);
    onChanged();
  }
  const statusLabel =
    run.status === "completed"
      ? anyLost
        ? refundHit
          ? "refund due"
          : "acca lost"
        : "acca won"
      : run.status;
  const laidCount = legs.filter((l) => l.layStake != null).length;
  const nextReady = legs.find((l) => {
    if (l.result !== "pending" || l.layStake != null || anyLost) return false;
    return !legs.some((earlier) => earlier.seq < l.seq && earlier.result === "pending");
  });
  const nextReadyTitle = nextReady
    ? deskLegTitleParts(
        nextReady,
        nextReady.eventId != null ? eventById.get(nextReady.eventId) ?? null : null
      ).primary
    : null;
  const detailsSummary = [
    `${legs.length} leg${legs.length === 1 ? "" : "s"}`,
    ACCA_METHOD_HELP[run.method].label,
    nextReadyTitle ? `next ${nextReadyTitle}` : laidCount > 0 ? `${laidCount} laid` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const foldName = accaFoldNameFromResults(legs);
  const ladderLegs = legs.map((l) => ({
    seq: l.seq,
    label: deskLegTitleParts(
      l,
      l.eventId != null ? eventById.get(l.eventId) ?? null : null
    ).primary,
    backOdds: l.backOdds,
    result: l.result,
    layStake: l.layStake,
    layOdds: l.layOdds,
  }));
  const funding =
    active && !anyLost
      ? accaExchangeFundingModel({
          method: run.method,
          stake: run.stake,
          commission: run.commission,
          boostPct: run.boostPct,
          legs: ladderLegs,
          accounts: state?.balances?.accounts,
          exchangeId: defaultExchange?.id ?? null,
        })
      : null;
  const allWinEst = accaAllWinEstimate(
    {
      stake: run.stake,
      commission: run.commission,
      method: run.method,
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      boostPct: run.boostPct,
      backBetType,
    },
    ladderLegs
  );

  // Mid-run: tint from square provisional when known; otherwise wait for
  // finished / busted Campaign P&L.
  const headerTint = stillOpen
    ? squareProv != null && squareProv.value > 0.005
      ? "offer-header-tint-win"
      : squareProv != null && squareProv.value < -0.005
        ? "offer-header-tint-loss"
        : undefined
    : campaignProfit > 0.005
      ? "offer-header-tint-win"
      : campaignProfit < -0.005
        ? "offer-header-tint-loss"
        : undefined;

  return (
    <Card className={cn(offerCampaignCardShell, "flex-col gap-0 py-0")}>
      <CardHeader
        className={cn(campaignCardHeader, headerTint ?? "bg-card")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {run.bookmaker ? <VenueBadge name={run.bookmaker} size="md" /> : null}
              <Badge variant="outline" className={cn("gap-1 pr-1 font-normal", campaignCardBadge)}>
                {ACCA_METHOD_HELP[run.method].label}
                <AccaMethodHelpDialog
                  focus={run.method}
                  trigger="icon"
                  className="size-4 shrink-0 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground"
                />
              </Badge>
              <Badge
                variant={active ? "secondary" : "outline"}
                className={cn("capitalize", campaignCardBadge)}
              >
                {statusLabel}
              </Badge>
              {run.refundAmount ? (
                <Badge variant="outline" className={cn("font-normal", campaignCardBadge)}>
                  £{run.refundAmount.toFixed(0)} refund
                </Badge>
              ) : null}
              {backBetType === "free_snr" || backBetType === "free_sr" ? (
                <Badge
                  variant="outline"
                  className={cn(campaignFbBadge, campaignCardBadge)}
                >
                  {backBetType === "free_sr" ? "Free bet (SR)" : "Free bet"}
                </Badge>
              ) : null}
            </div>
            <CardTitle className={campaignCardTitle}>{run.label}</CardTitle>
            <p className={campaignCardStakeLine}>
              <ComboKindMark kind="accumulator" suffix={foldName} />
              <span>£{run.stake.toFixed(2)}</span>
              <span className="font-medium text-muted-foreground">@</span>
              {boosted ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default font-semibold text-primary-text underline decoration-dotted underline-offset-2">
                        {combinedOdds.toFixed(2)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Boosted {run.boostPct}% - raw price {rawCombinedOdds.toFixed(2)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <span>{combinedOdds.toFixed(2)}</span>
              )}
            </p>
            {bustedLeg ? (
              <p className={cn(campaignCardNextAction, "font-medium")}>
                Busted at leg {bustedLeg.seq} - finished, no further lays needed.
              </p>
            ) : nextReady && nextReadyTitle ? (
              <p className={campaignCardNextAction}>
                Next: lay {nextReadyTitle}
                {nextReady.scheduledAt != null
                  ? ` · starts ${formatClockTime(nextReady.scheduledAt)}`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {stillOpen ? (
              squareProv != null ? (
                <>
                  <p className={campaignCardPnlLabel}>
                    {squareProv.kind === "locked" ? "Locked" : "Worst outcome"}
                  </p>
                  <MoneyFlow
                    value={squareProv.value}
                    signColor
                    signDisplay
                    className={cn(campaignCardPnl, "leading-tight")}
                  />
                </>
              ) : (
                <>
                  <p className={campaignCardPnlLabel}>Campaign P&L</p>
                  <p
                    className={cn(
                      campaignCardPnl,
                      "leading-tight text-muted-foreground"
                    )}
                  >
                    In progress
                  </p>
                </>
              )
            ) : (
              <>
                <p className={campaignCardPnlLabel}>Campaign P&L</p>
                <MoneyFlow
                  value={campaignProfit}
                  signColor
                  signDisplay
                  className={cn(campaignCardPnl, "leading-tight")}
                />
              </>
            )}
          </div>
        </div>

        <OutcomeProbabilityBar
          legs={legs}
          mode={active ? "live" : "at_start"}
          className={campaignCardHeaderBlock}
        />
        {funding ? (
          <ExchangeFundingNotice
            model={funding}
            compact
            className={campaignCardHeaderBlock}
          />
        ) : null}
      </CardHeader>

      <div className="offer-card-details border-t border-border/50">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className={campaignCardDetailsToggle}
          aria-expanded={detailsOpen}
        >
          <span className={campaignCardDetailsLabel}>Details</span>
          {!detailsOpen ? (
            <span className={campaignCardDetailsSummary}>{detailsSummary}</span>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              detailsOpen && "rotate-180"
            )}
          />
        </button>

        {detailsOpen ? (
          <div className="border-t border-border/50">
            {isWholeComboAccaMethod(run.method) &&
            active &&
            run.noLay !== 1 &&
            run.wholeLayBetId == null ? (
              <WholeLayRow run={run} combinedOdds={combinedOdds} onChanged={onChanged} />
            ) : null}
            {run.method === "combined" && active && run.noLay === 1 ? (
              <p className="border-t border-border/50 px-(--card-spacing) py-2 text-xs text-muted-foreground">
                No lay — back only. Settle legs when results land.
              </p>
            ) : null}

            <div className="py-2.5 pl-[calc(var(--card-spacing)+0.75rem-8px)] pr-(--card-spacing)">
              <AccaLegsTimeline
                run={run}
                legs={legs}
                now={now}
                renderLeg={(leg) => (
                  <LegRow
                    run={run}
                    legs={legs}
                    leg={leg}
                    now={now}
                    stillOpen={stillOpen}
                    event={
                      leg.eventId != null
                        ? eventById.get(leg.eventId) ?? null
                        : null
                    }
                    onChanged={onChanged}
                  />
                )}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 px-(--card-spacing) py-2.5 text-xs text-muted-foreground">
              <span>
                Liabilities paid{" "}
                <span className="font-medium tabular-nums">£{prior.toFixed(2)}</span>
              </span>
              {active && !isWholeComboAccaMethod(run.method) ? (
                <span>
                  {backBetType === "free_snr" || backBetType === "free_sr"
                    ? "Next leg loss: free stake not at risk (cover still sized as cash)"
                    : "Next leg loss: covered (≈ £0)"}
                </span>
              ) : null}
              {allWinEst != null ? (
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                  If all win (est.):{" "}
                  <MoneyFlow
                    value={allWinEst.value}
                    signColor
                    signDisplay
                    className="inline font-medium"
                  />
                  {allWinEst.usedProxy ? (
                    <EvBasisBadge
                      basis="estimated"
                      description="Remaining lays sized at bookie prices until you log the exchange bet."
                    />
                  ) : null}
                </span>
              ) : null}
              {refundHit && run.status === "completed" ? (
                <span className="font-medium text-success">
                  Exactly one leg lost - claim the £{run.refundAmount!.toFixed(2)} refund
                </span>
              ) : null}
              {active ? (
                <label className="ml-auto flex max-w-full items-center gap-2 text-right text-xs text-muted-foreground">
                  <span className="min-w-0 leading-snug">
                    Remind me 30 min before each leg starts
                  </span>
                  <Switch
                    className="shrink-0 scale-75"
                    checked={!run.muteAlerts}
                    onCheckedChange={(on) =>
                      void patchRun(
                        { muteAlerts: !on },
                        on ? "Lay reminders on" : "Lay reminders muted"
                      )
                    }
                    aria-label="Remind me 30 minutes before each leg starts to lay"
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-3.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={campaignCardFooterMeta}>
            {legs.length} leg{legs.length === 1 ? "" : "s"}
            {laidCount > 0 ? ` · ${laidCount} laid` : ""}
            {stillOpen ? " · in progress" : ` · ${statusLabel}`}
          </span>
          <DeleteRunButton
            label={run.label}
            onDeleted={async () => {
              await api(`/api/acca/${run.id}`, { method: "DELETE" }).catch(() => {});
              onChanged();
            }}
          />
        </div>
        <EditAccaRunDialog
          edit={{ run, legs, backBetType }}
          onSaved={onChanged}
        />
      </CardContent>
    </Card>
  );
}

function DeleteRunButton({
  label,
  onDeleted,
}: {
  label: string;
  onDeleted: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    try {
      await onDeleted();
      toast.success("Acca run deleted");
      setOpen(false);
    } catch (e) {
      toast.error("Could not delete run", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" mobile="center">
        <DialogHeader>
          <DialogTitle>Delete “{label}”?</DialogTitle>
          <DialogDescription>
            Linked open bets will be voided.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LegRow({
  run,
  legs,
  leg,
  now,
  stillOpen,
  event,
  onChanged,
}: {
  run: AccaRunRow;
  legs: AccaLegRow[];
  leg: AccaLegRow;
  now: number;
  stillOpen: boolean;
  event?: Pick<EventRow, "sport" | "homeTeam" | "awayTeam" | "status"> | null;
  onChanged: () => void;
}) {
  const title = deskLegTitleParts(leg, event);
  const [layOdds, setLayOdds] = useState(NaN);
  const [layStake, setLayStake] = useState(NaN);
  const [stakeTouched, setStakeTouched] = useState(false);
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [prevExchangeSync, setPrevExchangeSync] = useState<{
    def: ExchangeRow | null;
    cur: ExchangeRow | null;
  } | null>(null);
  if (
    prevExchangeSync === null ||
    prevExchangeSync.def !== defaultExchange ||
    prevExchangeSync.cur !== exchange
  ) {
    setPrevExchangeSync({ def: defaultExchange, cur: exchange });
    if (exchange == null && defaultExchange) setExchange(defaultExchange);
  }
  const active = run.status === "active";
  // layStake != null covers a real lay and deliberate £0 no-lay.
  const laid = leg.layStake != null;
  const isNoLayLogged = laid && leg.layStake === 0;

  const earlierPending = legs.some((l) => l.seq < leg.seq && l.result === "pending");
  const anyLost = legs.some((l) => l.result === "lost");
  const withinLead =
    leg.scheduledAt == null || leg.scheduledAt - now <= DEFAULT_LAY_LEAD_MINUTES * 60_000;
  const notExpired = leg.scheduledAt == null || leg.scheduledAt >= now - LAY_DUE_EXPIRY_MS;
  // Next actionable leg can be laid any time (including right after create).
  // The 30-minute lead window only drives alerts / Daily Plan, not the form.
  const canLay =
    active &&
    !isWholeComboAccaMethod(run.method) &&
    leg.result === "pending" &&
    !laid &&
    !anyLost &&
    !earlierPending &&
    notExpired;
  const alertDue = canLay && withinLead;

  // Sequential lock never lays again once it's busted - a still-pending
  // leg at that point is finished as far as the desk is concerned, not
  // awaited (insurance methods keep waiting - the other legs still decide
  // whether exactly one loss qualifies for the refund).
  const moot = run.method === "sequential" && anyLost && leg.result === "pending";
  const wholeComboCovered =
    isWholeComboAccaMethod(run.method) && (run.wholeLayBetId != null || run.noLay === 1);
  const autoResultNote = deskLegAutoResultNote({
    linked: leg.eventId != null,
    result: leg.result,
    moot,
    actionDone: laid || wholeComboCovered,
    isCurrent: isWholeComboAccaMethod(run.method) || !earlierPending,
    eventStatus: event?.status ?? null,
    sport: event?.sport ?? leg.sport,
  });
  // Per-leg £ contribution once its lay has actually settled - liability
  // paid when the back leg won (lay lost), or the lay's win kept when the
  // back leg lost - null while unlaid, void or still pending. £0 no-lay
  // contributes nothing.
  const legContribution =
    leg.layStake != null && leg.layStake > 0 && leg.layOdds != null && leg.layOdds > 1
      ? leg.result === "won"
        ? -(leg.layStake * (leg.layOdds - 1))
        : leg.result === "lost"
          ? leg.layStake * (1 - run.commission)
          : null
      : null;
  const isFinal = legs.every((l) => l.seq <= leg.seq || l.result !== "pending");
  const prior = priorLayLiabilities(legs);
  const needsLayOddsForStake = run.method === "sequential" && isFinal;
  const suggestion = useMemo(() => {
    if (!canLay) return null;
    if (run.method === "sequential" && isFinal) {
      if (!(layOdds > 1)) return null;
      return finalLegLockLay({
        accaStake: run.stake,
        combinedBackOdds: applyAccaBoost(combined(legs), run.boostPct),
        priorLiabilities: prior,
        legLayOdds: layOdds,
        commission: run.commission,
      })?.layStake ?? null;
    }
    // Cover stake (sequential non-final + insurance_legs) does not use lay
    // odds for sizing - but we still require the user to enter the live
    // exchange price before logging, so liabilities roll forward correctly.
    return nextSequentialLay({
      accaStake: run.stake,
      priorLiabilities: prior,
      commission: run.commission,
    });
  }, [canLay, run, legs, isFinal, prior, layOdds]);

  const [prevSuggestion, setPrevSuggestion] = useState<{
    current: number | null;
  } | null>(null);
  if (prevSuggestion === null || prevSuggestion.current !== suggestion) {
    setPrevSuggestion({ current: suggestion });
    if (!stakeTouched && suggestion != null) setLayStake(suggestion);
  }

  const isNoLayStake = Number.isFinite(layStake) && layStake === 0;
  const canLog = isNoLayStake || (layOdds > 1 && layStake > 0);

  async function logLay() {
    if (!canLog) return;
    await api(`/api/acca/legs/${leg.id}`, {
      method: "PATCH",
      json: {
        lay: {
          layOdds: isNoLayStake ? 0 : layOdds,
          layStake,
          exchangeId: isNoLayStake ? null : exchange?.id ?? defaultExchange?.id ?? null,
        },
      },
    }).catch(() => {});
    if (isNoLayStake) {
      toast.message("No lay logged", {
        description: "Back only on this leg, settle when the result lands.",
      });
    } else {
      toast.success(`Lay logged · £${layStake.toFixed(2)} @ ${layOdds.toFixed(2)}`);
    }
    onChanged();
  }
  async function setResult(result: "won" | "lost" | "void") {
    // Linked lays mark via api(); also mark the run back bet (not on the leg payload).
    markUserSettledBetIds([run.backBetId, leg.layBetId]);
    await api(`/api/acca/legs/${leg.id}`, { method: "PATCH", json: { result } }).catch(() => {});
    onChanged();
  }

  const isLaidPending = laid && leg.result === "pending";
  /**
   * Right-side status: never echo raw "pending" (repeats on every waiting leg).
   * Only show actionable / terminal stage labels; waiting legs stay quiet.
   */
  const statusLabel = moot
    ? "Not needed"
    : alertDue
      ? "Lay due"
      : canLay
        ? "Ready to lay"
        : isLaidPending
          ? null
          : leg.result === "pending"
            ? null
            : leg.result === "won"
              ? "Won"
              : leg.result === "lost"
                ? "Lost"
                : leg.result === "void"
                  ? "Void"
                  : null;
  const statusChip =
    statusLabel == null
      ? null
      : moot
        ? MUTED_CHIP
        : canLay || alertDue
          ? READY_CHIP
          : RESULT_CHIP[leg.result];

  const oddsHelp = needsLayOddsForStake
    ? "Live exchange price. Stake updates with the odds you enter."
    : "Live exchange price, not the bookie back odds. Alerts still fire from 30 min before the leg starts.";

  return (
    <div
      className={cn(
        "min-w-0",
        // Highlight bleeds sideways via matching -mx/px so titles stay on the
        // same x as sibling legs; no top pad so the rail dot stays on the name.
        canLay && "rounded-md bg-selection-subtle/50 px-2 pb-1.5 -mx-2",
        moot && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-2 leading-5">
            <span className="truncate text-sm font-medium leading-5">
              {title.primary}
              {title.secondary ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {title.secondary}
                </span>
              ) : null}
            </span>
            {laid ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-foreground px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-background"
                title={
                  isNoLayLogged
                    ? "No lay on this leg"
                    : leg.layStake != null && leg.layOdds != null
                      ? `Laid £${leg.layStake.toFixed(2)} @ ${leg.layOdds.toFixed(2)}`
                      : "Lay placed"
                }
              >
                <Check className="size-3 stroke-[2.5]" aria-hidden />
                {isNoLayLogged ? "No lay" : "Laid"}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
            Backed @ {leg.backOdds.toFixed(2)}
            {leg.scheduledAt
              ? ` · ${new Date(leg.scheduledAt).toLocaleDateString([], { weekday: "short" })} ${formatClockTime(leg.scheduledAt)}`
              : ""}
            {laid && leg.layStake != null
              ? isNoLayLogged
                ? " · no lay"
                : ` · £${leg.layStake.toFixed(2)} @ ${leg.layOdds?.toFixed(2)}`
              : ""}
          </span>
          {autoResultNote ? <LegAutoResultNote note={autoResultNote} /> : null}
        </span>
        {legContribution != null ? (
          stillOpen && leg.result === "won" ? (
            <span
              className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
              title="Exchange liability paid — campaign P&L settles when the run finishes"
            >
              £{Math.abs(legContribution).toFixed(2)} liab
            </span>
          ) : (
            <span className="shrink-0 text-xs font-semibold tabular-nums">
              <MoneyFlow value={legContribution} signColor signDisplay />
            </span>
          )
        ) : null}
        {statusLabel != null && statusChip != null ? (
          <Badge variant="outline" className={cn("gap-1 text-[11px]", statusChip)}>
            {leg.result === "won" ? <Check className="size-3 stroke-[2.5]" aria-hidden /> : null}
            {statusLabel}
          </Badge>
        ) : null}
        {active && leg.result === "pending" && laid && leg.eventId == null ? (
          <span className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void setResult("void")}
            >
              Void
            </Button>
            <Button variant="success" size="sm" onClick={() => void setResult("won")}>
              Won
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void setResult("lost")}>
              Lost
            </Button>
          </span>
        ) : null}
      </div>

      {canLay ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <NumField
            label="Lay odds"
            value={layOdds}
            onChange={setLayOdds}
            min={1.01}
            placeholder="Exchange"
            exchangeOddsStepping
            labelExtra={<FieldHelp label="Lay odds help">{oddsHelp}</FieldHelp>}
            className="w-[7.5rem]"
          />
          <NumField
            label="Lay stake"
            value={layStake}
            onChange={(v) => {
              setStakeTouched(true);
              setLayStake(v);
            }}
            min={0}
            prefix="£"
            layStakeStepping
            placeholder={suggestion != null ? suggestion.toFixed(2) : "–"}
            labelExtra={
              <FieldHelp label="Lay stake help">
                Suggested cover stake. Edit if you placed a different amount, or £0.00 to log no
                lay.
              </FieldHelp>
            }
            className="w-[7.5rem]"
          />
          <div className="w-[9.5rem]">
            <ExchangeSelect exchanges={exchanges} value={exchange} onChange={setExchange} />
          </div>
          <div className="flex items-center gap-2 pb-px">
            {canLog && !isNoLayStake ? (
              <FillSlipButton
                className="h-8"
                intent={{ side: "lay", selection: title.primary, stake: layStake, odds: layOdds }}
              />
            ) : null}
            <Button size="sm" className="h-8" onClick={() => void logLay()} disabled={!canLog}>
              {isNoLayStake ? "Log no lay" : "Log lay"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ALL WIN / 1 LOSE / 1+ LOSE readout.
 * Active: live posterior (settled legs certain). Completed: going-in estimate
 * from locked back odds so History supports reflection against anticipation.
 */
function OutcomeProbabilityBar({
  legs,
  mode,
  className,
}: {
  legs: AccaLegRow[];
  mode: "live" | "at_start";
  className?: string;
}) {
  const { allWinPct, oneLosePct, atLeastOneLosePct } = accaOutcomePercentages(legs, { mode });
  const atStart = mode === "at_start";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-1.5", className)}>
      <EvBasisBadge
        basis="heuristic"
        description={
          atStart
            ? "Going-in estimate from each leg's back odds (1/odds), not a no-vig fair price. Shown on finished runs so you can compare anticipation to what happened."
            : "Naive implied probability from each leg's back odds (1/odds), not a no-vig fair price. Settled legs count as certain while the run is live."
        }
        className="shrink-0"
      />
      {atStart ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          At start
        </span>
      ) : null}
      <ProbabilityMeter label="All win" pct={allWinPct} tone="success" />
      <ProbabilityMeter label="1 lose" pct={oneLosePct} tone="warning" />
      <ProbabilityMeter label="1+ lose" pct={atLeastOneLosePct} tone="destructive" />
    </div>
  );
}

function ProbabilityMeter({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "success" | "warning" | "destructive";
}) {
  const barClass = { success: "bg-success", warning: "bg-warning", destructive: "bg-destructive" }[tone];
  const textClass = { success: "text-success", warning: "text-warning", destructive: "text-destructive" }[tone];
  return (
    <div className="flex min-w-[92px] flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className={cn("tabular-nums", textClass)}>{pct.toFixed(1)}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10}
        aria-label={`${label} ${pct.toFixed(1)} percent`}
      >
        <div
          className={cn("h-full rounded-full", barClass)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function WholeLayRow({
  run,
  combinedOdds,
  onChanged,
}: {
  run: AccaRunRow;
  combinedOdds: number;
  onChanged: () => void;
}) {
  const [layOdds, setLayOdds] = useState(NaN);
  const [layStake, setLayStake] = useState(NaN);
  const [stakeTouched, setStakeTouched] = useState(false);
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [prevExchangeSync, setPrevExchangeSync] = useState<{
    def: ExchangeRow | null;
    cur: ExchangeRow | null;
  } | null>(null);
  if (
    prevExchangeSync === null ||
    prevExchangeSync.def !== defaultExchange ||
    prevExchangeSync.cur !== exchange
  ) {
    setPrevExchangeSync({ def: defaultExchange, cur: exchange });
    if (exchange == null && defaultExchange) setExchange(defaultExchange);
  }
  const suggestion = useMemo(
    () =>
      layOdds > 1
        ? wholeAccaLay({ stake: run.stake, combinedOdds, layOdds, commission: run.commission })
        : null,
    [run, combinedOdds, layOdds]
  );
  const [prevSuggestion, setPrevSuggestion] = useState<{
    current: typeof suggestion;
  } | null>(null);
  if (prevSuggestion === null || prevSuggestion.current !== suggestion) {
    setPrevSuggestion({ current: suggestion });
    if (!stakeTouched && suggestion != null) setLayStake(suggestion.layStake);
  }
  const isNoLayStake = Number.isFinite(layStake) && layStake === 0;
  const canLog =
    (isNoLayStake && run.method === "combined") || (layOdds > 1 && layStake > 0);
  async function log() {
    if (!canLog) return;
    if (isNoLayStake) {
      await markNoLay();
      return;
    }
    await api(`/api/acca/${run.id}`, {
      method: "PATCH",
      json: {
        wholeLay: {
          layOdds,
          layStake,
          exchangeId: exchange?.id ?? defaultExchange?.id ?? null,
        },
      },
    }).catch(() => {});
    toast.success(`Whole-acca lay logged · £${layStake.toFixed(2)} @ ${layOdds.toFixed(2)}`);
    onChanged();
  }
  async function markNoLay() {
    await api(`/api/acca/${run.id}`, {
      method: "PATCH",
      json: { noLay: true },
    }).catch(() => {});
    toast.message("Marked no lay", { description: "Back only, settle legs when results land." });
    onChanged();
  }
  return (
    <div className="space-y-2 border-b border-border/50 bg-selection-subtle/50 px-(--card-spacing) py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {run.method === "combined" ? "Combined lay" : "Whole-acca lay"}
        </p>
        <div className="flex items-center gap-2">
          {run.method === "combined" ? (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void markNoLay()}>
              No lay
            </Button>
          ) : null}
          <Badge variant="outline" className="text-[11px] capitalize text-primary-text border-primary/30 bg-primary/10">
            ready to lay
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <NumField
          label="Lay odds"
          value={layOdds}
          onChange={setLayOdds}
          min={1.01}
          placeholder="Exchange"
          exchangeOddsStepping
          labelExtra={
            <FieldHelp label="Combined lay odds help">
              Live combined exchange price for the whole acca. Stake updates with the odds you enter.
            </FieldHelp>
          }
          className="w-[7.5rem]"
        />
        <NumField
          label="Lay stake"
          value={layStake}
          onChange={(v) => {
            setStakeTouched(true);
            setLayStake(v);
          }}
          min={0}
          prefix="£"
          layStakeStepping
          placeholder={suggestion != null ? suggestion.layStake.toFixed(2) : "–"}
          labelExtra={
            <FieldHelp label="Lay stake help">
              Suggested equalising stake. Edit if you placed a different amount, or £0.00 to log
              no lay.
            </FieldHelp>
          }
          className="w-[7.5rem]"
        />
        <div className="w-[9.5rem]">
          <ExchangeSelect exchanges={exchanges} value={exchange} onChange={setExchange} />
        </div>
        <div className="flex items-center gap-2 pb-px">
          {canLog && !isNoLayStake ? (
            <FillSlipButton
              className="h-8"
              intent={{ side: "lay", selection: run.label, stake: layStake, odds: layOdds }}
            />
          ) : null}
          <Button size="sm" className="h-8" onClick={() => void log()} disabled={!canLog}>
            {isNoLayStake ? "Log no lay" : "Log lay"}
          </Button>
        </div>
        {suggestion ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-8 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  <CircleHelp className="size-3.5 shrink-0" aria-hidden />
                  Preview
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[16rem] text-xs leading-relaxed">
                All win {suggestion.profitIfAllWin >= 0 ? "+" : ""}£
                {suggestion.profitIfAllWin.toFixed(2)} · any loss{" "}
                {suggestion.profitIfAnyLose >= 0 ? "+" : ""}£{suggestion.profitIfAnyLose.toFixed(2)}
                {run.refundAmount
                  ? ` (+£${run.refundAmount.toFixed(0)} refund if exactly one leg loses)`
                  : ""}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );
}
