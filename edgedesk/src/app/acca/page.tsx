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
import { Layers, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { PageShell } from "@/components/page-shell";
import { NumField } from "@/components/calc/num-field";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { MoneyFlow } from "@/components/money-flow";
import { api } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import {
  DEFAULT_LAY_LEAD_MINUTES,
  LAY_DUE_EXPIRY_MS,
  finalLegLockLay,
  nextSequentialLay,
  priorLayLiabilities,
  wholeAccaLay,
} from "@/lib/calc/acca-workflow";
import type { AccaLegRow, AccaRunRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type RunView = { run: AccaRunRow; legs: AccaLegRow[] };

const METHOD_LABEL: Record<AccaRunRow["method"], string> = {
  sequential: "Sequential lock",
  insurance_legs: "Insurance · leg-by-leg",
  insurance_whole: "Insurance · whole acca",
};

const RESULT_CHIP: Record<AccaLegRow["result"], string> = {
  pending: "border-muted-foreground/30 text-muted-foreground",
  won: "border-success/30 bg-success/10 text-success",
  lost: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  void: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function combined(legs: AccaLegRow[]): number {
  return legs.filter((l) => l.result !== "void").reduce((a, l) => a * l.backOdds, 1);
}

export default function AccaDeskPage() {
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
          runs.map((rv) => <RunCard key={rv.run.id} view={rv} onChanged={load} />)
        )}
      </div>
    </PageShell>
  );
}

function RunCard({ view, onChanged }: { view: RunView; onChanged: () => void }) {
  const { run, legs } = view;
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
  const combinedOdds = combined(legs);
  const active = run.status === "active";
  const anyLost = legs.some((l) => l.result === "lost");
  const lostCount = legs.filter((l) => l.result === "lost").length;
  const refundHit =
    run.method !== "sequential" && lostCount === 1 && (run.refundAmount ?? 0) > 0;

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <span className="text-sm font-semibold">{run.label}</span>
        <Badge variant="outline" className="text-[10px]">
          {METHOD_LABEL[run.method]}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">
          £{run.stake.toFixed(2)} @ {combinedOdds.toFixed(2)}
          {run.bookmaker ? ` · ${run.bookmaker}` : ""}
          {run.refundAmount ? ` · refund £${run.refundAmount.toFixed(0)}` : ""}
        </span>
        <Badge
          variant={run.status === "active" ? "secondary" : "outline"}
          className="text-[10px] capitalize"
        >
          {run.status === "completed" ? (anyLost ? (refundHit ? "refund due" : "acca lost") : "acca won") : run.status}
        </Badge>
        <span className="ml-auto flex items-center gap-2">
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
            aria-label={`Delete run ${run.label}`}
            onClick={() => void removeRun()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </span>
      </div>

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

  const isFinal = legs.every((l) => l.seq <= leg.seq || l.result !== "pending");
  const prior = priorLayLiabilities(legs);
  const suggestion = useMemo(() => {
    if (!due || !(layOdds > 1)) return null;
    if (run.method === "sequential" && isFinal) {
      return finalLegLockLay({
        accaStake: run.stake,
        combinedBackOdds: combined(legs),
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
        due && "bg-selection-subtle/50"
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
            ? ` · ${new Date(leg.scheduledAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}`
            : ""}
          {laid && leg.layStake != null ? ` · laid £${leg.layStake.toFixed(2)} @ ${leg.layOdds?.toFixed(2)}` : ""}
          {leg.eventId != null ? " · auto-result" : ""}
        </span>
      </span>
      <Badge variant="outline" className={cn("text-[10px] capitalize", RESULT_CHIP[leg.result])}>
        {due ? "lay due" : laid && leg.result === "pending" ? "laid" : leg.result}
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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...pagePrimaryButtonProps}>
          <Plus className="size-4" /> New run
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {open ? (
          <CreateRunForm
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

function CreateRunForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [method, setMethod] = useState<AccaRunRow["method"]>("sequential");
  const [stake, setStake] = useState(10);
  const [bookmaker, setBookmaker] = useState("");
  const [commissionPct, setCommissionPct] = useState(0);
  const [refundAmount, setRefundAmount] = useState(NaN);
  const [legs, setLegs] = useState<LegDraft[]>([
    { label: "", backOdds: NaN, scheduledAt: "" },
    { label: "", backOdds: NaN, scheduledAt: "" },
    { label: "", backOdds: NaN, scheduledAt: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const validLegs = legs.filter((l) => l.label.trim() && l.backOdds > 1);
  const combinedOdds = validLegs.reduce((a, l) => a * l.backOdds, 1);
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
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="acca-label" className="text-xs text-muted-foreground">
            Run label
          </Label>
          <Input
            id="acca-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Bet365 weekend 4-fold"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as AccaRunRow["method"])}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">Sequential lock</SelectItem>
              <SelectItem value="insurance_legs">Insurance · lay leg-by-leg</SelectItem>
              <SelectItem value="insurance_whole">Insurance · lay whole acca</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Bookmaker</Label>
          <BookmakerSelect value={bookmaker} onChange={setBookmaker} />
        </div>
        <NumField label="Acca stake" prefix="£" value={stake} onChange={setStake} min={0.01} />
        <NumField
          label="Exchange commission (%)"
          value={commissionPct}
          onChange={setCommissionPct}
          min={0}
          step={0.5}
        />
        {method !== "sequential" ? (
          <NumField
            label="Refund free bet"
            prefix="£"
            value={refundAmount}
            onChange={setRefundAmount}
            min={0}
            placeholder="e.g. 10"
            className="col-span-2"
            hint="Awarded when exactly one leg loses"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Legs (in play order)</Label>
        {legs.map((leg, i) => (
          <div key={i} className="flex items-end gap-2">
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
              className="w-20"
            />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Kick-off</span>
              <Input
                type="datetime-local"
                className="w-44"
                value={leg.scheduledAt}
                onChange={(e) =>
                  setLegs(legs.map((l, j) => (j === i ? { ...l, scheduledAt: e.target.value } : l)))
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
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
