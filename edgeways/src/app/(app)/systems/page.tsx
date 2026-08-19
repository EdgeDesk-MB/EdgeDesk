"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Grid2x2, Trash2 } from "lucide-react";
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
import { FilterPill } from "@/components/ui/filter-pill";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { CreateSystemRunDialog, EditSystemRunDialog } from "@/components/systems/create-run-dialog";
import { FlowTimeline, FlowTimelineStep } from "@/components/ui/flow-timeline";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { ComboKindMark } from "@/components/combo-kind-mark";
import { api } from "@/hooks/use-app-state";
import {
  systemFamily,
  systemStructureLabel,
  type SystemStructureType,
} from "@/lib/calc/systems-settle";
import { cn } from "@/lib/utils";
import type { SystemLegRow, SystemRunRow } from "@/lib/db/schema";
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

type Tab = "active" | "history";
type FamilyFilter = "all" | "lucky" | "cover";

const CLASSIFICATION_LABEL: Record<string, string> = {
  ev_play: "EV play",
  mug_bet: "Mug bet",
  qualifying: "Qualifying",
};

type RunBundle = {
  run: SystemRunRow;
  legs: SystemLegRow[];
  backBetType: string | null;
  campaignProfit: number | null;
};

export default function SystemsDeskPage() {
  const [runs, setRuns] = useState<RunBundle[] | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [family, setFamily] = useState<FamilyFilter>("all");

  const load = useCallback(async () => {
    try {
      const data = await api<{ runs: RunBundle[] }>("/api/systems");
      setRuns(data.runs);
    } catch {
      toast.error("Could not load system bets");
      setRuns([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRuns = useMemo(
    () => runs?.filter((r) => r.run.status === "active") ?? [],
    [runs]
  );
  const historyRuns = useMemo(
    () => runs?.filter((r) => r.run.status !== "active") ?? [],
    [runs]
  );

  function filterFamily(list: RunBundle[]) {
    if (family === "all") return list;
    return list.filter(
      (r) => systemFamily(r.run.structure as SystemStructureType) === family
    );
  }

  const activeFiltered = filterFamily(activeRuns);
  const historyFiltered = filterFamily(historyRuns);

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Systems Desk"
        description="Full-cover tickets: Lucky 15s, Yankees, Trixies. Log what you placed, settle legs, track P&L - not a finder."
        helpId="systems"
        icon={Grid2x2}
        action={<CreateSystemRunDialog onCreated={load} />}
      />
      <div className="flex flex-col gap-3 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {runs == null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Grid2x2}
            title="No system bets yet"
            description="Use New system bet and paste a Lucky Finder or bookie slip, or add selections manually. Edgeways organises and settles - it does not find the bets."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className={filterPillGroup} role="tablist" aria-label="System bets">
              {(
                [
                  { id: "active" as const, label: "Active", count: activeRuns.length },
                  { id: "history" as const, label: "History", count: historyRuns.length },
                ] as const
              ).map((q) => {
                const selected = tab === q.id;
                return (
                  <FilterPill
                    key={q.id}
                    active={selected}
                    hasCount
                    onClick={() => setTab(q.id)}
                  >
                    {q.label}
                    <span className={filterPillCountState(selected)}>{q.count}</span>
                  </FilterPill>
                );
              })}
            </div>

            <div className={filterPillGroup} aria-label="Structure family">
              {(
                [
                  ["all", "All"],
                  // With singles = Patent + Lucky 15/31/63; No singles = Trixie…Goliath
                  ["lucky", "With singles"],
                  ["cover", "No singles"],
                ] as const
              ).map(([id, label]) => (
                <FilterPill
                  key={id}
                  active={family === id}
                  onClick={() => setFamily(id)}
                >
                  {label}
                </FilterPill>
              ))}
            </div>

            {tab === "active" ? (
              activeFiltered.length === 0 ? (
                <EmptyState
                  icon={Grid2x2}
                  title={
                    family === "all"
                      ? "No active system bets"
                      : family === "lucky"
                        ? "No active system bets with singles"
                        : "No active system bets with no singles"
                  }
                  description="Every ticket has finished - check History, or start a new one."
                />
              ) : (
                activeFiltered.map((bundle) => (
                  <RunCard key={bundle.run.id} bundle={bundle} onChanged={load} />
                ))
              )
            ) : historyFiltered.length === 0 ? (
              <EmptyState
                icon={Grid2x2}
                title="No finished system bets yet"
                description="Completed tickets move here once every selection has settled."
              />
            ) : (
              historyFiltered.map((bundle) => (
                <RunCard
                  key={bundle.run.id}
                  bundle={bundle}
                  onChanged={load}
                  collapsedByDefault
                />
              ))
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function RunCard({
  bundle,
  onChanged,
  collapsedByDefault = false,
}: {
  bundle: RunBundle;
  onChanged: () => void;
  collapsedByDefault?: boolean;
}) {
  const { run, legs, backBetType, campaignProfit } = bundle;
  const [detailsOpen, setDetailsOpen] = useState(!collapsedByDefault);
  const active = run.status === "active";
  const structureLabel = systemStructureLabel(run.structure as SystemStructureType);
  const pnl = campaignProfit ?? 0;
  const pending = legs.some((l) => l.result === "pending");
  const statusLabel =
    run.status === "completed"
      ? "settled"
      : run.status === "abandoned"
        ? "abandoned"
        : pending
          ? "in progress"
          : "active";

  const classificationLabel =
    CLASSIFICATION_LABEL[run.classification] ?? run.classification;
  const detailsSummary = [
    structureLabel,
    `${run.lines} lines`,
    run.eachWay ? "each-way" : null,
    classificationLabel,
    pending ? "awaiting results" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const stillOpen = active && pending;
  const headerTint = stillOpen
    ? undefined
    : pnl > 0.005
      ? "offer-header-tint-win"
      : pnl < -0.005
        ? "offer-header-tint-loss"
        : undefined;

  async function setLegResult(legId: number, result: "won" | "placed" | "lost" | "void") {
    try {
      await api(`/api/systems/${run.id}`, {
        method: "PATCH",
        json: { legId, result },
      });
      onChanged();
    } catch {
      toast.error("Could not update selection");
    }
  }

  const isEw = run.eachWay === 1;
  const placeTermsLabel =
    run.placeFraction != null
      ? run.placeFraction === 0.25
        ? "1/4"
        : run.placeFraction === 0.2
          ? "1/5"
          : `${Math.round(run.placeFraction * 100)}%`
      : null;

  return (
    <Card className={cn(offerCampaignCardShell, "flex-col gap-0 py-0")}>
      <CardHeader
        className={cn(campaignCardHeader, headerTint ?? "bg-card")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {run.bookmaker ? <VenueBadge name={run.bookmaker} size="md" /> : null}
              <Badge
                variant={active ? "secondary" : "outline"}
                className={cn("capitalize", campaignCardBadge)}
              >
                {statusLabel}
              </Badge>
              {run.eachWay ? (
                <Badge variant="outline" className={cn("font-normal", campaignCardBadge)}>
                  Each-way
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
              <Badge variant="outline" className={cn("font-normal", campaignCardBadge)}>
                {classificationLabel}
              </Badge>
            </div>
            <CardTitle className={campaignCardTitle}>{run.label}</CardTitle>
            <p className={campaignCardStakeLine}>
              <ComboKindMark kind="systems" suffix={structureLabel} />
              <span>£{run.totalStake.toFixed(2)}</span>
              <span className="font-medium text-muted-foreground">·</span>
              <span className="font-medium text-muted-foreground">
                £{run.unitStake.toFixed(2)} unit
              </span>
            </p>
            <p className={campaignCardNextAction}>
              {run.lines} lines
              {isEw ? ` · each-way${placeTermsLabel ? ` ${placeTermsLabel}` : ""}` : ""}
              {active && pending ? " · settle legs as results land" : ""}
            </p>
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
                  value={pnl}
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
            <p className="border-b border-border/50 px-(--card-spacing) py-2 text-xs text-muted-foreground">
              No lay, organisation only. Mark each selection when results land
              {isEw ? " (Placed = places but not winner)" : ""}.
            </p>
            <div className="px-(--card-spacing) py-2.5">
              <FlowTimeline>
                {legs.map((leg, i) => {
                  const tone: "done" | "lost" | "muted" | "pending" =
                    leg.result === "won" || leg.result === "placed"
                      ? "done"
                      : leg.result === "lost"
                        ? "lost"
                        : leg.result === "void"
                          ? "muted"
                          : "pending";
                  return (
                    <FlowTimelineStep
                      key={leg.id}
                      tone={tone}
                      first={i === 0}
                      last={i === legs.length - 1}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium leading-5 text-foreground">
                            <span className="mr-1.5 text-xs tabular-nums text-muted-foreground">
                              {leg.seq}.
                            </span>
                            {leg.label}
                          </span>
                          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                            @{leg.oddsDecimal.toFixed(2)}
                          </p>
                        </div>
                        {active && leg.result === "pending" ? (
                          <span className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void setLegResult(leg.id, "void")}
                            >
                              Void
                            </Button>
                            {isEw ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 border-success/40 text-xs text-success"
                                onClick={() => void setLegResult(leg.id, "placed")}
                              >
                                Placed
                              </Button>
                            ) : null}
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => void setLegResult(leg.id, "won")}
                            >
                              Won
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void setLegResult(leg.id, "lost")}
                            >
                              Lost
                            </Button>
                          </span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 text-[11px] capitalize",
                              leg.result === "won" &&
                                "border-success/30 bg-success/10 text-success",
                              leg.result === "placed" &&
                                "border-success/30 bg-success/10 text-success",
                              leg.result === "lost" &&
                                "border-destructive/40 bg-destructive/10 text-destructive",
                              leg.result === "void" &&
                                "border-muted-foreground/30 bg-muted text-muted-foreground",
                              leg.result === "pending" &&
                                "border-warning/40 bg-warning/10 text-warning"
                            )}
                          >
                            {leg.result === "won" ? (
                              <Check className="size-3 stroke-[2.5]" aria-hidden />
                            ) : null}
                            {leg.result}
                          </Badge>
                        )}
                      </div>
                    </FlowTimelineStep>
                  );
                })}
              </FlowTimeline>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 px-(--card-spacing) py-2.5 text-xs text-muted-foreground">
              <span>
                Total stake{" "}
                <span className="font-medium tabular-nums text-foreground">
                  £{run.totalStake.toFixed(2)}
                </span>
              </span>
              <span>No lay, back only</span>
            </div>
          </div>
        ) : null}
      </div>

      <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-3.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={campaignCardFooterMeta}>
            {legs.length} selections · {statusLabel}
            {run.eachWay ? " · EW" : ""}
          </span>
          <DeleteRunButton
            label={run.label}
            onDeleted={async () => {
              await api(`/api/systems/${run.id}`, { method: "DELETE" });
              onChanged();
            }}
          />
        </div>
        <EditSystemRunDialog
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
      toast.success("System bet deleted");
      setOpen(false);
    } catch (e) {
      toast.error("Could not delete system bet", { description: String(e) });
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
