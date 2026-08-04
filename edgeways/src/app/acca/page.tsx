"use client";

/**
 * Acca Desk (J7) - run acca offers as guided multi-day workflows. Three
 * methods (Sam: all in v1): sequential lock (zero-loss cover per leg,
 * final leg equalised), insurance leg-by-leg (same recursion, refund when
 * exactly one leg loses), insurance whole-acca (one combined lay). The
 * desk orchestrates; every back and lay is a REAL tracker bet.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, CalendarClock, ChevronDown, Layers, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { PageShell } from "@/components/page-shell";
import { NumField } from "@/components/calc/num-field";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { BackPanel, PanelInput, PanelSelect, PanelTextInput } from "@/components/calc/bet-panels";
import { MoneyFlow } from "@/components/money-flow";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { useNow } from "@/hooks/use-now";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  accaCampaignProfit,
  accaOutcomePercentages,
  applyAccaBoost,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
  wholeAccaLay,
} from "@/lib/calc/acca-workflow";
import type { AccaLegRow, AccaRunRow, ExchangeRow } from "@/lib/db/schema";
import { formatClockTime } from "@/lib/time-format";
import { campaignHeaderBand } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { FillSlipButton } from "@/components/fill-slip-button";

type RunView = { run: AccaRunRow; legs: AccaLegRow[] };

const METHOD_LABEL: Record<AccaRunRow["method"], string> = {
  sequential: "Sequential lock",
  insurance_legs: "Insurance · leg-by-leg",
  insurance_whole: "Insurance · whole acca",
};

const RESULT_CHIP: Record<AccaLegRow["result"], string> = {
  pending: "border-muted-foreground/30 text-muted-foreground",
  won: "border-success/30 bg-success/10 text-success",
  lost: "border-destructive/40 bg-destructive/10 text-destructive",
  void: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function combined(legs: AccaLegRow[]): number {
  return legs.filter((l) => l.result !== "void").reduce((a, l) => a * l.backOdds, 1);
}

export default function AccaDeskPage() {
  const [runs, setRuns] = useState<RunView[] | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
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

  const activeRuns = useMemo(() => runs?.filter((r) => r.run.status === "active") ?? [], [runs]);
  const historyRuns = useMemo(() => runs?.filter((r) => r.run.status !== "active") ?? [], [runs]);

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Acca Desk"
        description="Run acca offers leg by leg - the desk tells you when and how much to lay, and every trade is a real tracker bet."
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "history")}>
            <TabsList variant="segmented">
              <TabsTrigger value="active">Active ({activeRuns.length})</TabsTrigger>
              <TabsTrigger value="history">History ({historyRuns.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-3 flex flex-col gap-3">
              {activeRuns.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="No active runs"
                  description="Every run has finished - check History, or start a new one."
                />
              ) : (
                activeRuns.map((rv) => <RunCard key={rv.run.id} view={rv} onChanged={load} />)
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-3 flex flex-col gap-3">
              {historyRuns.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No finished runs yet.
                </p>
              ) : (
                historyRuns.map((rv) => (
                  <RunCard key={rv.run.id} view={rv} onChanged={load} collapsedByDefault />
                ))
              )}
            </TabsContent>
          </Tabs>
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
  const { run, legs } = view;
  const [collapsed, setCollapsed] = useState(collapsedByDefault);
  const now = useNow(30_000);
  const prior = priorLayLiabilities(legs);
  // Auditor F2: the all-win projection must carry EVERY placed liability -
  // lays on pending legs and the whole-acca lay included (voids excluded).
  const placedLiabilities =
    legs
      .filter((l) => l.layBetId != null && l.result !== "void" && l.result !== "lost")
      .reduce((a, l) => a + (l.layStake ?? 0) * ((l.layOdds ?? 1) - 1), 0) +
    (run.wholeLayBetId != null && run.wholeLayStake != null && run.wholeLayOdds != null
      ? run.wholeLayStake * (run.wholeLayOdds - 1)
      : 0);
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
    },
    legs
  );
  const stillOpen = active && !anyLost && legs.some((l) => l.result === "pending");

  async function patchRun(json: Record<string, unknown>, msg: string) {
    await api(`/api/acca/${run.id}`, { method: "PATCH", json }).catch(() => {});
    toast.success(msg);
    onChanged();
  }
  async function removeRun() {
    await api(`/api/acca/${run.id}`, { method: "DELETE" }).catch(() => {});
    onChanged();
  }

  return (
    <div className="rounded-lg border bg-card">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border/50 px-4 py-2.5",
          campaignHeaderBand
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{run.label}</span>
            <Badge variant="outline" className="text-[10px]">
              {METHOD_LABEL[run.method]}
            </Badge>
            <Badge variant={active ? "secondary" : "outline"} className="text-[10px] capitalize">
              {run.status === "completed"
                ? anyLost
                  ? refundHit
                    ? "refund due"
                    : "acca lost"
                  : "acca won"
                : run.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            £{run.stake.toFixed(2)} @{" "}
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
              combinedOdds.toFixed(2)
            )}
            {run.bookmaker ? ` · ${run.bookmaker}` : ""}
            {run.refundAmount ? ` · refund £${run.refundAmount.toFixed(0)}` : ""}
          </p>
          {bustedLeg ? (
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              Busted at leg {bustedLeg.seq} - finished, no further lays needed.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right text-xs tabular-nums">
            <div className="text-muted-foreground">
              Campaign P&L
              {stillOpen ? (
                <span className="ml-1 font-normal normal-case tracking-normal text-[10px]">
                  (open)
                </span>
              ) : null}
            </div>
            <MoneyFlow
              value={campaignProfit}
              signColor
              signDisplay
              className="text-[1.1rem] font-bold leading-tight"
            />
          </div>
          {active ? (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              Alerts
              <Switch
                className="scale-75"
                checked={!run.muteAlerts}
                onCheckedChange={(on) => void patchRun({ muteAlerts: !on }, on ? "Alerts on" : "Alerts muted")}
                aria-label="Lay-due alerts for this run"
              />
            </label>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label={collapsed ? `Expand run ${run.label}` : `Collapse run ${run.label}`}
            onClick={() => setCollapsed((c) => !c)}
          >
            <ChevronDown className={cn("size-4 transition-transform", !collapsed && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label={`Delete run ${run.label}`}
            onClick={() => void removeRun()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <OutcomeProbabilityBar legs={legs} />

      {!collapsed ? (
        <>
          {run.method === "insurance_whole" && active && run.wholeLayBetId == null ? (
            <WholeLayRow run={run} combinedOdds={combinedOdds} onChanged={onChanged} />
          ) : null}

          <div className="flex flex-col">
            {legs.map((leg) => (
              <LegRow key={leg.id} run={run} legs={legs} leg={leg} now={now} onChanged={onChanged} />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              Liabilities paid <span className="font-medium tabular-nums">£{prior.toFixed(2)}</span>
            </span>
            {active && run.method !== "insurance_whole" ? (
              <span>Next leg loss: covered (≈ £0)</span>
            ) : null}
            <span>
              If all win (est.):{" "}
              <MoneyFlow
                value={run.stake * (combinedOdds - 1) - placedLiabilities}
                signColor
                signDisplay
                className="inline font-medium"
              />
            </span>
            {refundHit && run.status === "completed" ? (
              <span className="font-medium text-success">
                Exactly one leg lost - claim the £{run.refundAmount!.toFixed(2)} refund
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function LegRow({
  run,
  legs,
  leg,
  now,
  onChanged,
}: {
  run: AccaRunRow;
  legs: AccaLegRow[];
  leg: AccaLegRow;
  now: number;
  onChanged: () => void;
}) {
  const [layOdds, setLayOdds] = useState(leg.backOdds);
  const active = run.status === "active";
  const laid = leg.layBetId != null;

  const earlierPending = legs.some((l) => l.seq < leg.seq && l.result === "pending");
  const anyLost = legs.some((l) => l.result === "lost");
  const withinLead =
    leg.scheduledAt == null || leg.scheduledAt - now <= DEFAULT_LAY_LEAD_MINUTES * 60_000;
  const notExpired = leg.scheduledAt == null || leg.scheduledAt >= now - LAY_DUE_EXPIRY_MS;
  const due =
    active &&
    run.method !== "insurance_whole" &&
    leg.result === "pending" &&
    !laid &&
    !anyLost &&
    !earlierPending &&
    withinLead &&
    notExpired;

  // Sequential lock never lays again once it's busted - a still-pending
  // leg at that point is finished as far as the desk is concerned, not
  // awaited (insurance methods keep waiting - the other legs still decide
  // whether exactly one loss qualifies for the refund).
  const moot = run.method === "sequential" && anyLost && leg.result === "pending";
  // Per-leg £ contribution once its lay has actually settled - liability
  // paid when the back leg won (lay lost), or the lay's win kept when the
  // back leg lost - null while unlaid, void or still pending.
  const legContribution =
    leg.layStake != null && leg.layOdds != null
      ? leg.result === "won"
        ? -(leg.layStake * (leg.layOdds - 1))
        : leg.result === "lost"
          ? leg.layStake * (1 - run.commission)
          : null
      : null;
  const isFinal = legs.every((l) => l.seq <= leg.seq || l.result !== "pending");
  const prior = priorLayLiabilities(legs);
  const suggestion = useMemo(() => {
    if (!due || !(layOdds > 1)) return null;
    if (run.method === "sequential" && isFinal) {
      return finalLegLockLay({
        accaStake: run.stake,
        combinedBackOdds: applyAccaBoost(combined(legs), run.boostPct),
        priorLiabilities: prior,
        legLayOdds: layOdds,
        commission: run.commission,
      })?.layStake ?? null;
    }
    return nextSequentialLay({
      accaStake: run.stake,
      priorLiabilities: prior,
      commission: run.commission,
    });
  }, [due, run, legs, isFinal, prior, layOdds]);

  async function logLay() {
    if (suggestion == null) return;
    await api(`/api/acca/legs/${leg.id}`, {
      method: "PATCH",
      json: { lay: { layOdds, layStake: suggestion } },
    }).catch(() => {});
    toast.success(`Lay logged · £${suggestion.toFixed(2)} @ ${layOdds.toFixed(2)}`);
    onChanged();
  }
  async function setResult(result: "won" | "lost" | "void") {
    await api(`/api/acca/legs/${leg.id}`, { method: "PATCH", json: { result } }).catch(() => {});
    onChanged();
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 last:border-b-0",
        due && "bg-selection-subtle/50",
        moot && "opacity-60"
      )}
    >
      <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {leg.seq}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{leg.label}</span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          back {leg.backOdds.toFixed(2)}
          {leg.scheduledAt
            ? ` · ${new Date(leg.scheduledAt).toLocaleDateString([], { weekday: "short" })} ${formatClockTime(leg.scheduledAt)}`
            : ""}
          {laid && leg.layStake != null ? ` · laid £${leg.layStake.toFixed(2)} @ ${leg.layOdds?.toFixed(2)}` : ""}
          {leg.eventId != null ? " · auto-result" : ""}
        </span>
      </span>
      {legContribution != null ? (
        <span className="shrink-0 text-xs font-semibold tabular-nums">
          <MoneyFlow value={legContribution} signColor signDisplay />
        </span>
      ) : null}
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] capitalize",
          moot ? "border-muted-foreground/20 text-muted-foreground/70" : RESULT_CHIP[leg.result]
        )}
      >
        {due ? "lay due" : moot ? "not needed" : laid && leg.result === "pending" ? "laid" : leg.result}
      </Badge>
      {due ? (
        <span className="flex items-center gap-2">
          <NumField
            label="Lay odds"
            value={layOdds}
            onChange={setLayOdds}
            min={1.01}
            step={0.01}
            className="w-24"
          />
          {suggestion != null ? (
            <FillSlipButton
              className="mt-5 h-8"
              intent={{ side: "lay", selection: leg.label, stake: suggestion, odds: layOdds }}
            />
          ) : null}
          <Button size="sm" className="mt-5 h-8" onClick={() => void logLay()} disabled={suggestion == null}>
            Lay £{suggestion?.toFixed(2) ?? "–"}
          </Button>
        </span>
      ) : null}
      {active && leg.result === "pending" && !due && leg.eventId == null ? (
        <span className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void setResult("won")}>
            Won
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void setResult("lost")}>
            Lost
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void setResult("void")}>
            Void
          </Button>
        </span>
      ) : null}
    </div>
  );
}

/** ALL WIN / 1 LOSE / 1+ LOSE readout - sharpens as legs actually settle. */
function OutcomeProbabilityBar({ legs }: { legs: AccaLegRow[] }) {
  const { allWinPct, oneLosePct, atLeastOneLosePct } = accaOutcomePercentages(legs);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b px-4 py-2.5">
      <EvBasisBadge
        basis="heuristic"
        description="Naive implied probability from each leg's back odds (1/odds) - not a no-vig fair price. Settled legs count as certain."
        className="shrink-0"
      />
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
      <div className="flex items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className={cn("tabular-nums", textClass)}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
  const [layOdds, setLayOdds] = useState(Number((combinedOdds * 1.05).toFixed(2)));
  const suggestion = useMemo(
    () =>
      layOdds > 1
        ? wholeAccaLay({ stake: run.stake, combinedOdds, layOdds, commission: run.commission })
        : null,
    [run, combinedOdds, layOdds]
  );
  async function log() {
    if (!suggestion) return;
    await api(`/api/acca/${run.id}`, {
      method: "PATCH",
      json: { wholeLay: { layOdds, layStake: suggestion.layStake } },
    }).catch(() => {});
    toast.success(`Whole-acca lay logged · £${suggestion.layStake.toFixed(2)}`);
    onChanged();
  }
  return (
    <div className="flex flex-wrap items-end gap-3 border-b bg-selection-subtle/50 px-4 py-3">
      <NumField
        label="Combined lay odds"
        value={layOdds}
        onChange={setLayOdds}
        min={1.01}
        step={0.1}
        className="w-36"
      />
      <Button size="sm" onClick={() => void log()} disabled={!suggestion}>
        Lay whole acca £{suggestion?.layStake.toFixed(2) ?? "–"}
      </Button>
      {suggestion ? (
        <span className="pb-1 text-xs tabular-nums text-muted-foreground">
          all win {suggestion.profitIfAllWin >= 0 ? "+" : ""}£{suggestion.profitIfAllWin.toFixed(2)} · any
          loss {suggestion.profitIfAnyLose >= 0 ? "+" : ""}£{suggestion.profitIfAnyLose.toFixed(2)}
          {run.refundAmount ? ` (+£${run.refundAmount.toFixed(0)} refund if exactly one leg loses)` : ""}
        </span>
      ) : null}
    </div>
  );
}

function CreateRunDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  // Loaded here (not inside CreateRunForm) so the Acca Bet panel already has
  // the user's default exchange colour by the time the dialog first opens -
  // otherwise every open re-mounts the hook and flashes the MBB green
  // fallback while the exchange list re-fetches.
  const { defaultExchange } = useExchanges();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...pagePrimaryButtonProps}>
          <Plus className="size-4" /> New run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
        {open ? (
          <CreateRunForm
            defaultExchange={defaultExchange}
            onDone={() => {
              setOpen(false);
              onCreated();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type LegDraft = { label: string; backOdds: number; scheduledAt: string };

function CreateRunForm({
  defaultExchange,
  onDone,
}: {
  defaultExchange: ExchangeRow | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [method, setMethod] = useState<AccaRunRow["method"]>("sequential");
  const [stake, setStake] = useState(10);
  const [bookmaker, setBookmaker] = useState("");
  const [commissionPct, setCommissionPct] = useState(0);
  const [refundAmount, setRefundAmount] = useState(NaN);
  const [boosted, setBoosted] = useState(false);
  const [boostPct, setBoostPct] = useState(NaN);
  const [legs, setLegs] = useState<LegDraft[]>([
    { label: "", backOdds: NaN, scheduledAt: "" },
    { label: "", backOdds: NaN, scheduledAt: "" },
    { label: "", backOdds: NaN, scheduledAt: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const validLegs = legs.filter((l) => l.label.trim() && l.backOdds > 1);
  const rawCombinedOdds = validLegs.reduce((a, l) => a * l.backOdds, 1);
  const combinedOdds = applyAccaBoost(rawCombinedOdds, boosted && boostPct > 0 ? boostPct : null);
  const canSave = label.trim().length > 0 && stake > 0 && validLegs.length >= 2;

  async function save() {
    setSaving(true);
    try {
      await api("/api/acca", {
        method: "POST",
        json: {
          label: label.trim(),
          method,
          stake,
          bookmaker: bookmaker.trim() || null,
          commission: Number.isFinite(commissionPct) ? commissionPct / 100 : 0,
          refundAmount:
            method !== "sequential" && Number.isFinite(refundAmount) ? refundAmount : null,
          boostPct: boosted && boostPct > 0 ? boostPct : null,
          legs: validLegs.map((l) => ({
            label: l.label.trim(),
            backOdds: l.backOdds,
            scheduledAt: l.scheduledAt ? new Date(l.scheduledAt).getTime() : null,
          })),
        },
      });
      toast.success("Acca run created", { description: "The back bet is in the tracker." });
      onDone();
    } catch (e) {
      toast.error("Could not create run", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New acca run</DialogTitle>
        <DialogDescription>
          The acca back is logged as a real tracker bet; the desk then tells you when and how
          much to lay per leg.
        </DialogDescription>
      </DialogHeader>

      <BackPanel
        title="Acca Bet"
        exchange={defaultExchange}
        venue={bookmaker}
        chip={
          <BookmakerSelect
            value={bookmaker}
            onChange={setBookmaker}
            className="[--pi:var(--panel)] [--pi-dark:var(--panel-dark)]"
          />
        }
      >
        <PanelTextInput
          label="Run label"
          value={label}
          onChange={setLabel}
          placeholder="e.g. Bet365 weekend 4-fold"
        />
        <PanelSelect
          label="Method"
          value={method}
          onChange={(v) => setMethod(v as AccaRunRow["method"])}
        >
          <option value="sequential">Sequential lock</option>
          <option value="insurance_legs">Insurance · lay leg-by-leg</option>
          <option value="insurance_whole">Insurance · lay whole acca</option>
        </PanelSelect>
        <div className="grid grid-cols-2 gap-3">
          <PanelInput
            label="Acca stake"
            prefix="£"
            value={stake}
            onChange={setStake}
            min={0.01}
            placeholder="10.00"
          />
          <PanelInput
            label="Exchange commission"
            suffix="%"
            value={commissionPct}
            onChange={setCommissionPct}
            min={0}
            step={0.5}
            placeholder="2.00"
          />
        </div>
        {method !== "sequential" ? (
          <PanelInput
            label="Refund free bet"
            prefix="£"
            value={refundAmount}
            onChange={setRefundAmount}
            min={0}
            placeholder="e.g. 10"
          />
        ) : null}
        {method !== "sequential" ? (
          <p className="text-[11px] font-medium text-black/60 dark:text-white/70">
            Refund awarded when exactly one leg loses
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-[11px] font-semibold text-black/60 dark:text-white/70">
          <input
            type="checkbox"
            checked={boosted}
            onChange={(e) => setBoosted(e.target.checked)}
            className="size-3.5 accent-black/70 dark:accent-white/80"
          />
          This acca is boosted
        </label>
        {boosted ? (
          <>
            <PanelInput
              label="Boost"
              suffix="%"
              value={boostPct}
              onChange={setBoostPct}
              min={0}
              step={5}
              placeholder="e.g. 50"
            />
            <p className="text-[11px] font-medium text-black/60 dark:text-white/70">
              Boosts your winnings only, not the stake return - e.g. a 50% boost on 3.0 combined
              odds pays out at 4.0, not 4.5
            </p>
          </>
        ) : null}
      </BackPanel>

      <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4">
        <Label className="text-xs text-muted-foreground">Legs (in play order)</Label>
        {legs.map((leg, i) => (
          <div key={i} className="flex min-w-0 items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Input
                value={leg.label}
                onChange={(e) =>
                  setLegs(legs.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))
                }
                placeholder={`Leg ${i + 1} - e.g. Arsenal to win`}
              />
            </div>
            <NumField
              label="Odds"
              value={leg.backOdds}
              onChange={(v) => setLegs(legs.map((l, j) => (j === i ? { ...l, backOdds: v } : l)))}
              min={1.01}
              step={0.01}
              className="w-20 shrink-0"
            />
            <KickOffField
              value={leg.scheduledAt}
              onChange={(v) => setLegs(legs.map((l, j) => (j === i ? { ...l, scheduledAt: v } : l)))}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={`Remove leg ${i + 1}`}
              disabled={legs.length <= 2}
              onClick={() => setLegs(legs.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setLegs([...legs, { label: "", backOdds: NaN, scheduledAt: "" }])}
            disabled={legs.length >= 12}
          >
            <Plus className="size-3.5" /> Add leg
          </Button>
          {validLegs.length >= 2 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              Combined {combinedOdds.toFixed(2)} · returns £{(stake * combinedOdds).toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>

      <Button onClick={() => void save()} disabled={saving || !canSave}>
        Create run
      </Button>
    </>
  );
}

/** Icon-only kick-off picker - fills once a date is set, shows it on hover. */
function KickOffField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const set = value.trim().length > 0;
  const label = set
    ? `${new Date(value).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}, ${formatClockTime(new Date(value))}`
    : "Kick-off";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <label
            className={cn(
              "relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border text-muted-foreground transition-colors hover:text-foreground",
              set && "border-primary/40 bg-primary/10 text-primary-text"
            )}
          >
            {set ? <CalendarCheck className="size-4" /> : <CalendarClock className="size-4" />}
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              aria-label={label}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
