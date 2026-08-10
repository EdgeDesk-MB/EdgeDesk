"use client";

/**
 * Bet Builder Desk: same-event combo, one kick-off, Combined lay or No lay.
 * Card chrome matches Acca Desk (campaign header, Details, footer).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { markUserSettledBetIds } from "@/lib/alerts/user-originated";
import { ChevronDown, CircleHelp, Puzzle, Trash2 } from "lucide-react";
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
import {
  CreateBetBuilderRunDialog,
  EditBetBuilderRunDialog,
} from "@/components/bet-builder/create-run-dialog";
import { BetBuilderSelectionsList } from "@/components/bet-builder/selections-list";
import { NumField } from "@/components/calc/num-field";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { FillSlipButton } from "@/components/fill-slip-button";
import { ComboKindMark } from "@/components/combo-kind-mark";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { bbCampaignProfit, wholeComboLay } from "@/lib/calc/bet-builder-workflow";
import { accaFoldNameFromResults } from "@/lib/bets/acca-fold-name";
import { formatClockTime } from "@/lib/time-format";
import {
  campaignCardBadge,
  campaignFbBadge,
  campaignCardDetailsLabel,
  campaignCardDetailsSummary,
  campaignCardFooterMeta,
  campaignCardHeader,
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
import type { BetBuilderRunRow, BetBuilderSelectionRow } from "@/lib/db/schema";

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

type RunView = {
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
  backBetType: string | null;
};

function methodLabel(method: BetBuilderRunRow["method"]): string {
  return method === "no_lay" ? "No lay" : "Combined lay";
}

export default function BetBuilderDeskPage() {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
  const load = useCallback(() => {
    api<{ runs: RunView[] }>("/api/bet-builder")
      .then((r) => setRuns(r.runs ?? []))
      .catch(() => setRuns([]));
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const activeRuns = useMemo(
    () => runs?.filter((r) => r.run.status === "active") ?? [],
    [runs]
  );
  const historyRuns = useMemo(
    () => runs?.filter((r) => r.run.status !== "active") ?? [],
    [runs]
  );

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Bet Builder Desk"
        description="Same-event builders: one kick-off, combined lay or deliberate no lay - every trade is a real tracker bet."
        helpId="bet-builder"
        icon={Puzzle}
        action={<CreateBetBuilderRunDialog onCreated={load} />}
      />
      <div className="flex flex-col gap-3 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {runs == null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Puzzle}
            title="No bet builder added yet"
            description="Use New bet builder, or Place from an offer that allows Bet builder. Match with one combined lay when you can, or No lay when there is no clean exchange market."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className={filterPillGroup} role="tablist" aria-label="Bet builders">
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
                  icon={Puzzle}
                  title="No active bet builders"
                  description="Every builder has finished - check History, or start a new one."
                />
              ) : (
                activeRuns.map((rv) => <RunCard key={rv.run.id} view={rv} onChanged={load} />)
              )
            ) : historyRuns.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No finished bet builders yet.
              </p>
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
  collapsedByDefault?: boolean;
}) {
  const { run, selections, backBetType } = view;
  const [detailsOpen, setDetailsOpen] = useState(!collapsedByDefault);
  const active = run.status === "active";
  const anyLost = selections.some((s) => s.result === "lost");
  const allResolved = selections.every((s) => s.result !== "pending");
  const stillOpen = active && !anyLost && selections.some((s) => s.result === "pending");
  const campaignProfit = bbCampaignProfit(
    {
      stake: run.stake,
      backOdds: run.backOdds,
      commission: run.commission,
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      backBetType,
    },
    selections
  );
  const laid = run.wholeLayBetId != null;
  const isNoLay = run.method === "no_lay";
  const layLiability =
    laid && run.wholeLayStake != null && run.wholeLayOdds != null
      ? run.wholeLayStake * (run.wholeLayOdds - 1)
      : 0;
  const ifAllWinEst = run.stake * (run.backOdds - 1) - layLiability;

  const allVoid = allResolved && selections.every((s) => s.result === "void");
  const statusLabel =
    run.status === "completed"
      ? anyLost
        ? "builder lost"
        : allVoid
          ? "void"
          : "builder won"
      : run.status === "abandoned"
        ? "abandoned"
        : isNoLay
          ? "no lay"
          : laid
            ? "laid"
            : "active";

  const foldName = accaFoldNameFromResults(selections);
  const detailsSummary = [
    foldName ?? `${selections.length} selection${selections.length === 1 ? "" : "s"}`,
    methodLabel(run.method),
    run.eventLabel ?? null,
    laid ? "laid" : isNoLay ? "back only" : "awaiting lay",
  ]
    .filter(Boolean)
    .join(" · ");

  const headerTint = stillOpen
    ? undefined
    : campaignProfit > 0.005
      ? "offer-header-tint-win"
      : campaignProfit < -0.005
        ? "offer-header-tint-loss"
        : undefined;

  async function patchRun(json: Record<string, unknown>, msg: string) {
    await api(`/api/bet-builder/${run.id}`, { method: "PATCH", json }).catch(() => {});
    toast.success(msg);
    onChanged();
  }

  async function settleBuilder(result: "won" | "lost" | "void") {
    try {
      // api() also marks from the response; belt-and-braces before the request.
      markUserSettledBetIds([run.backBetId, run.wholeLayBetId]);
      await api(`/api/bet-builder/${run.id}`, {
        method: "PATCH",
        json: { result },
      });
      toast.success(
        result === "won"
          ? "Bet builder won"
          : result === "lost"
            ? "Bet builder lost"
            : "Bet builder voided"
      );
      onChanged();
    } catch {
      toast.error("Could not settle bet builder");
    }
  }

  return (
    <Card className={cn(offerCampaignCardShell, "flex-col gap-0 py-0")}>
      <CardHeader
        className={cn(campaignCardHeader, headerTint ?? "bg-card")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {run.bookmaker ? <VenueBadge name={run.bookmaker} size="md" /> : null}
              <Badge variant="outline" className={cn("font-normal", campaignCardBadge)}>
                {methodLabel(run.method)}
              </Badge>
              <Badge
                variant={active ? "secondary" : "outline"}
                className={cn("capitalize", campaignCardBadge)}
              >
                {statusLabel}
              </Badge>
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
              <ComboKindMark kind="bet_builder" suffix={foldName} />
              <span>£{run.stake.toFixed(2)}</span>
              <span className="font-medium text-muted-foreground">@</span>
              <span>{run.backOdds.toFixed(2)}</span>
            </p>
            {run.eventLabel || run.scheduledAt != null ? (
              <p className={campaignCardNextAction}>
                {[
                  run.eventLabel,
                  run.scheduledAt != null
                    ? `${new Date(run.scheduledAt).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })} ${formatClockTime(new Date(run.scheduledAt))}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {active && run.method === "combined" && !laid ? (
              <p className={campaignCardNextAction}>Next: log the combined lay</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {stillOpen ? (
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
      </CardHeader>

      <div className="offer-card-details border-t border-border/50">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full min-h-9 min-w-0 items-center gap-2 overflow-hidden px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-foreground/5"
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
            {run.method === "combined" && active && !laid ? (
              <WholeLayRow run={run} onChanged={onChanged} />
            ) : null}
            {isNoLay ? (
              <p className="border-b border-border/50 px-(--card-spacing) py-2 text-xs text-muted-foreground">
                No lay, back only. Settle the builder when the ticket lands.
              </p>
            ) : null}
            {laid ? (
              <p className="border-b border-border/50 px-(--card-spacing) py-2 text-xs text-muted-foreground">
                Laid £{(run.wholeLayStake ?? 0).toFixed(2)} @ {(run.wholeLayOdds ?? 0).toFixed(2)}
              </p>
            ) : null}

            <div className="px-(--card-spacing) py-2.5">
              <BetBuilderSelectionsList
                selections={selections}
                stage={
                  active && !allResolved
                    ? isNoLay
                      ? "awaiting result"
                      : !laid
                        ? "awaiting combined lay"
                        : "awaiting result"
                    : null
                }
                headerRight={
                  active ? (
                    <span className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void settleBuilder("void")}
                      >
                        Void
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => void settleBuilder("won")}
                      >
                        Won
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void settleBuilder("lost")}
                      >
                        Lost
                      </Button>
                    </span>
                  ) : null
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 px-(--card-spacing) py-2.5 text-xs text-muted-foreground">
              <span>
                Liabilities paid{" "}
                <span className="font-medium tabular-nums">£{layLiability.toFixed(2)}</span>
              </span>
              {isNoLay ? (
                <span>No lay, back only</span>
              ) : (
                <span>
                  If builder wins (est.):{" "}
                  <MoneyFlow
                    value={ifAllWinEst}
                    signColor
                    signDisplay
                    className="inline font-medium"
                  />
                </span>
              )}
              {active ? (
                <label className="ml-auto flex max-w-full items-center gap-2 text-right text-xs text-muted-foreground">
                  <span className="min-w-0 leading-snug">
                    Remind me 30 min before kick-off
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
                    aria-label="Remind me 30 minutes before kick-off to lay"
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-3.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]">
        <span className={campaignCardFooterMeta}>
          {foldName ??
            `${selections.length} selection${selections.length === 1 ? "" : "s"}`}
          {laid ? " · laid" : isNoLay ? " · no lay" : ""}
          {stillOpen ? " · in progress" : ` · ${statusLabel}`}
        </span>
        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          <DeleteRunButton
            label={run.label}
            onDeleted={async () => {
              await api(`/api/bet-builder/${run.id}`, { method: "DELETE" }).catch(() => {});
              onChanged();
            }}
          />
          <EditBetBuilderRunDialog
            edit={{ run, selections, backBetType }}
            onSaved={onChanged}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WholeLayRow({ run, onChanged }: { run: BetBuilderRunRow; onChanged: () => void }) {
  const [layOdds, setLayOdds] = useState(NaN);
  const [layStake, setLayStake] = useState(NaN);
  const [stakeTouched, setStakeTouched] = useState(false);
  const { defaultExchange } = useExchanges();
  const suggestion = useMemo(
    () =>
      layOdds > 1
        ? wholeComboLay({
            stake: run.stake,
            combinedOdds: run.backOdds,
            layOdds,
            commission: run.commission,
          })
        : null,
    [run.stake, run.backOdds, run.commission, layOdds]
  );
  useEffect(() => {
    if (!stakeTouched && suggestion != null) setLayStake(suggestion.layStake);
  }, [suggestion, stakeTouched]);
  const canLog = layOdds > 1 && layStake > 0;

  async function log() {
    if (!canLog) return;
    try {
      await api(`/api/bet-builder/${run.id}`, {
        method: "PATCH",
        json: {
          wholeLay: {
            layOdds,
            layStake,
            exchangeId: defaultExchange?.id ?? null,
          },
        },
      });
      toast.success(`Combined lay logged · £${layStake.toFixed(2)} @ ${layOdds.toFixed(2)}`);
      onChanged();
    } catch {
      toast.error("Could not log lay");
    }
  }

  async function markNoLay() {
    try {
      await api(`/api/bet-builder/${run.id}`, {
        method: "PATCH",
        json: { noLay: true },
      });
      toast.message("Marked no lay", {
        description: "Back only, settle the builder when the ticket lands.",
      });
      onChanged();
    } catch {
      toast.error("Could not mark no lay");
    }
  }

  return (
    <div className="space-y-2 border-b border-border/50 bg-selection-subtle/50 px-(--card-spacing) py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">Combined lay</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void markNoLay()}>
            No lay
          </Button>
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/10 text-[11px] capitalize text-primary-text"
          >
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
          step={0.01}
          placeholder="Exchange"
          labelExtra={
            <FieldHelp label="Combined lay odds help">
              Live exchange price for the whole builder. Stake updates with the odds you enter.
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
          min={0.01}
          step={0.01}
          prefix="£"
          placeholder={suggestion != null ? suggestion.layStake.toFixed(2) : "–"}
          labelExtra={
            <FieldHelp label="Lay stake help">
              Suggested equalising stake. Edit if you placed a different amount.
            </FieldHelp>
          }
          className="w-[7.5rem]"
        />
        <div className="flex items-center gap-2 pb-px">
          {canLog ? (
            <FillSlipButton
              className="h-8"
              intent={{ side: "lay", selection: run.label, stake: layStake, odds: layOdds }}
            />
          ) : null}
          <Button size="sm" className="h-8" onClick={() => void log()} disabled={!canLog}>
            Log lay
          </Button>
        </div>
        {suggestion != null ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-8 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                  <CircleHelp className="size-3.5 shrink-0" aria-hidden />
                  Preview
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[16rem] text-xs leading-relaxed">
                Builder wins {suggestion.profitIfAllWin >= 0 ? "+" : ""}£
                {suggestion.profitIfAllWin.toFixed(2)} · any loss{" "}
                {suggestion.profitIfAnyLose >= 0 ? "+" : ""}£
                {suggestion.profitIfAnyLose.toFixed(2)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
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
      toast.success("Bet builder deleted");
      setOpen(false);
    } catch (e) {
      toast.error("Could not delete bet builder", { description: String(e) });
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
          <DialogTitle>Delete bet builder?</DialogTitle>
          <DialogDescription>
            Removes “{label}” from Bet Builder Desk. Linked tracker bets that are still open will
            be voided.
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
