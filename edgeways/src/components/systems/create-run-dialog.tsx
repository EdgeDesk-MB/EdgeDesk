"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { BetImportDialog } from "@/components/add-bet/bet-import-dialog";
import { DeferredTextInput } from "@/components/add-bet/deferred-text-input";
import { DateTimePicker } from "@/components/date-time-picker";
import { DeskLegEventFields } from "@/components/desk/desk-leg-event-fields";
import { DeskStakeSource } from "@/components/desk/desk-stake-source";
import { nextDeskLegLabel } from "@/lib/desk/desk-leg-title";
import { resolveDeskEventIdForSave } from "@/lib/desk/resolve-desk-event-id";
import { usePauseAppStatePolling } from "@/components/app-state-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  previewSystemStructure,
  SYSTEM_STRUCTURES,
  systemRequiredLegs,
  systemStructureLabel,
  type SystemStructureType,
} from "@/lib/calc/systems-settle";
import type { BetOcrFields } from "@/lib/ocr/types";
import { summariseOcrFields } from "@/lib/ocr/parse-bet-screenshot";
import {
  normaliseDeskBackBetType,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import type { KnownFixtureOption } from "@/lib/add-bet-event-options";
import { MARKETS } from "@/lib/markets";
import { toDatetimeLocalValue } from "@/lib/offers/offer-terms";
import type { SystemLegRow, SystemRunRow } from "@/lib/db/schema";
import {
  deskRunDialogBodyClass,
  deskRunDialogContentClass,
  deskRunLegsPanelClass,
} from "@/lib/ui/desk-run-dialog";
import { panelSurface } from "@/lib/ui/surface-styles";
import { MoneyFlow } from "@/components/money-flow";
import { cn } from "@/lib/utils";

type LegDraft = {
  id?: number;
  label: string;
  odds: number;
  sport: string;
  eventId: number | null;
  pendingFixture: KnownFixtureOption | null;
  market: string;
  selection: string;
  scheduledAt: string;
};

export type SystemRunEdit = {
  run: SystemRunRow;
  legs: SystemLegRow[];
  backBetType?: string | null;
};

function defaultMarketForSport(sport: string): string {
  return MARKETS[sport]?.[0]?.value ?? "other";
}

function emptyLegs(count: number, sport = "football"): LegDraft[] {
  const market = defaultMarketForSport(sport);
  return Array.from({ length: count }, () => ({
    label: "",
    odds: NaN,
    sport,
    eventId: null,
    pendingFixture: null,
    market,
    selection: "",
    scheduledAt: "",
  }));
}

function legsFromEdit(edit: SystemRunEdit): LegDraft[] {
  return edit.legs.map((l) => {
    const sport = l.sport?.trim() || "football";
    return {
      id: l.id,
      label: l.label,
      odds: l.oddsDecimal,
      sport,
      eventId: l.eventId ?? null,
      pendingFixture: null,
      market: l.market?.trim() || defaultMarketForSport(sport),
      selection: l.selection ?? "",
      scheduledAt:
        l.scheduledAt != null ? toDatetimeLocalValue(l.scheduledAt) : "",
    };
  });
}

function isSystemStructure(v: string | undefined): v is SystemStructureType {
  return v != null && (SYSTEM_STRUCTURES as string[]).includes(v);
}

function systemRunMoneyLocked(run: SystemRunRow, legs: SystemLegRow[]): boolean {
  if (run.status !== "active") return true;
  return legs.some((l) => l.result !== "pending");
}

export function CreateSystemRunForm({
  edit,
  onDone,
}: {
  edit?: SystemRunEdit | null;
  onDone: () => void;
}) {
  const isEdit = edit != null;
  const moneyLocked = isEdit ? systemRunMoneyLocked(edit.run, edit.legs) : false;
  usePauseAppStatePolling(true);
  const { state } = useAppState(0);
  const events = state?.events ?? [];

  const [label, setLabel] = useState(edit?.run.label ?? "");
  const [structure, setStructure] = useState<SystemStructureType>(
    (edit?.run.structure as SystemStructureType) ?? "lucky_15"
  );
  const [unitStake, setUnitStake] = useState(edit?.run.unitStake ?? 1);
  const [bookmaker, setBookmaker] = useState(edit?.run.bookmaker ?? "");
  const [eachWay, setEachWay] = useState(edit != null ? edit.run.eachWay === 1 : false);
  const [placeFraction, setPlaceFraction] = useState(
    edit?.run.placeFraction ?? 0.2
  );
  const [classification, setClassification] = useState<
    "ev_play" | "mug_bet" | "qualifying"
  >(
    (edit?.run.classification as "ev_play" | "mug_bet" | "qualifying") ??
      "ev_play"
  );
  const [backBetType, setBackBetType] = useState<DeskBackBetType>(() =>
    normaliseDeskBackBetType(edit?.backBetType ?? "qualifying")
  );
  const [legs, setLegs] = useState<LegDraft[]>(() =>
    edit != null ? legsFromEdit(edit) : emptyLegs(4)
  );
  const [saving, setSaving] = useState(false);

  const legCount = systemRequiredLegs(structure);

  function setStructureAndLegs(next: SystemStructureType) {
    if (isEdit) return;
    setStructure(next);
    const n = systemRequiredLegs(next);
    setLegs((prev) => {
      if (prev.length === n) return prev;
      if (prev.length > n) return prev.slice(0, n);
      const sport = prev[prev.length - 1]?.sport || "football";
      return [...prev, ...emptyLegs(n - prev.length, sport)];
    });
  }

  const preview = useMemo(() => {
    const filled = legs
      .slice(0, legCount)
      .map((l, i) => ({
        label: l.label.trim() || `Selection ${i + 1}`,
        oddsDecimal: l.odds > 1 ? l.odds : 2,
      }));
    if (filled.length !== legCount) return null;
    return previewSystemStructure(structure, unitStake > 0 ? unitStake : 1, filled);
  }, [legs, legCount, structure, unitStake]);

  const totalStake =
    preview != null ? preview.totalStake * (eachWay ? 2 : 1) : unitStake;

  function applyOcr(fields: BetOcrFields) {
    if (isEdit) return;
    const nextStructure = isSystemStructure(fields.structure)
      ? fields.structure
      : structure;
    if (isSystemStructure(fields.structure)) {
      setStructureAndLegs(fields.structure);
    }
    if (fields.isFreeBet) setBackBetType("free_snr");
    if (fields.unitStake != null && fields.unitStake > 0) {
      setUnitStake(fields.unitStake);
    } else if (fields.backStake != null && fields.backStake > 0) {
      const stub = previewSystemStructure(
        nextStructure,
        1,
        Array.from({ length: systemRequiredLegs(nextStructure) }, (_, i) => ({
          label: `L${i + 1}`,
          oddsDecimal: 2,
        }))
      );
      const lines = stub?.betCount ?? 1;
      const ew = fields.eachWay || fields.marketHint === "each_way";
      const divisor = ew ? lines * 2 : lines;
      setUnitStake(Math.round((fields.backStake / divisor) * 100) / 100);
    }
    if (fields.bookmaker) setBookmaker(fields.bookmaker);
    if (fields.eachWay || fields.marketHint === "each_way") setEachWay(true);
    if (fields.structure?.startsWith("lucky") || fields.eachWay) {
      setClassification("ev_play");
    }
    if (fields.legs && fields.legs.length > 0) {
      const n = isSystemStructure(fields.structure)
        ? systemRequiredLegs(fields.structure)
        : Math.max(fields.legs.length, legCount);
      const sport = "football";
      const market = defaultMarketForSport(sport);
      const next = emptyLegs(n, sport).map((blank, i) => {
        const src = fields.legs![i];
        if (!src) return blank;
        return {
          ...blank,
          label: src.label,
          odds: src.odds != null && src.odds > 1 ? src.odds : NaN,
        };
      });
      setLegs(next);
      if (!label.trim()) {
        setLabel(
          fields.legs
            .slice(0, 3)
            .map((l) => l.label)
            .join(" / ")
        );
      }
    } else if (fields.selection && !label.trim()) {
      setLabel(fields.selection);
    }
    const parts = summariseOcrFields(fields);
    toast.message("Slip applied", {
      description: parts.length ? parts.join(" · ") : "Review fields before saving.",
    });
  }

  async function save() {
    const draft = legs.slice(0, legCount);
    if (draft.some((l) => !l.label.trim() || !(l.odds > 1))) {
      toast.error("Fill every selection label and odds");
      return;
    }
    if (!(unitStake > 0)) {
      toast.error("Unit stake required");
      return;
    }
    setSaving(true);
    try {
      const cleaned = await Promise.all(
        draft.map(async (l) => ({
          ...(l.id != null ? { id: l.id } : {}),
          label: l.label.trim(),
          oddsDecimal: l.odds,
          sport: l.sport.trim() || "football",
          eventId: await resolveDeskEventIdForSave({
            eventId: l.eventId,
            pendingFixture: l.pendingFixture,
          }),
          market: l.market || null,
          selection: l.selection.trim() || null,
          scheduledAt: l.scheduledAt ? new Date(l.scheduledAt).getTime() : null,
        }))
      );
      if (isEdit && edit) {
        await api(`/api/systems/${edit.run.id}`, {
          method: "PATCH",
          json: {
            label: label.trim() || systemStructureLabel(structure),
            bookmaker: bookmaker.trim() || null,
            unitStake,
            eachWay,
            placeFraction: eachWay ? placeFraction : null,
            classification,
            backBetType,
            legs: cleaned,
          },
        });
        toast.success("System bet updated");
      } else {
        await api("/api/systems", {
          method: "POST",
          json: {
            label: label.trim() || systemStructureLabel(structure),
            structure,
            unitStake,
            bookmaker: bookmaker.trim() || null,
            eachWay,
            placeFraction: eachWay ? placeFraction : null,
            classification,
            backBetType,
            legs: cleaned.map(({ id: _id, ...rest }) => rest),
          },
        });
        toast.success(`${systemStructureLabel(structure)} logged`);
      }
      onDone();
    } catch {
      toast.error(isEdit ? "Could not update system bet" : "Could not save system bet");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit system bet" : "New system bet"}</DialogTitle>
        <DialogDescription
          explainer={
            isEdit && moneyLocked ? (
              <DialogExplainer title="What you can edit">
                Label, bookmaker, legs and event links. Stake and odds stay
                locked.
              </DialogExplainer>
            ) : !isEdit ? (
              <DialogExplainer title="New system bet">
                Paste a slip to pre-fill structure, stake and selections.
              </DialogExplainer>
            ) : undefined
          }
        >
          {isEdit
            ? moneyLocked
              ? "Stake and odds stay locked."
              : "Update the ticket details."
            : "Log a full-cover ticket."}
        </DialogDescription>
      </DialogHeader>
      <div className={deskRunDialogBodyClass}>

      <div className="flex flex-col gap-3">
        {!isEdit ? (
          <BetImportDialog onApply={(fields) => applyOcr(fields)} />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Structure</span>
            <Select
              value={structure}
              onValueChange={(v) => setStructureAndLegs(v as SystemStructureType)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_STRUCTURES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {systemStructureLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Unit stake (£)</span>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={Number.isFinite(unitStake) ? unitStake : ""}
              onChange={(e) => setUnitStake(parseFloat(e.target.value))}
              disabled={moneyLocked}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Label</span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Saturday Lucky 15"
          />
        </label>

        <BookmakerSelect value={bookmaker} onChange={setBookmaker} />

        <DeskStakeSource
          bookmaker={bookmaker}
          value={backBetType}
          onChange={setBackBetType}
          stake={totalStake}
          disabled={moneyLocked}
          onStakeFill={(amount) => {
            if (amount > 0 && preview != null && preview.betCount > 0) {
              const divisor = eachWay ? preview.betCount * 2 : preview.betCount;
              setUnitStake(Math.round((amount / divisor) * 100) / 100);
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={eachWay}
              onCheckedChange={setEachWay}
              disabled={moneyLocked}
            />
            <span>Each-way</span>
          </label>
          {eachWay ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Place terms</span>
              <Select
                value={String(placeFraction)}
                onValueChange={(v) => setPlaceFraction(parseFloat(v))}
                disabled={moneyLocked}
              >
                <SelectTrigger className="w-[8.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.25">1/4 odds</SelectItem>
                  <SelectItem value="0.2">1/5 odds</SelectItem>
                </SelectContent>
              </Select>
            </label>
          ) : null}
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">Classification</span>
            <Select
              value={classification}
              onValueChange={(v) =>
                setClassification(v as "ev_play" | "mug_bet" | "qualifying")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ev_play">EV play (e.g. Lucky Finder)</SelectItem>
                <SelectItem value="mug_bet">Mug bet</SelectItem>
                <SelectItem value="qualifying">Qualifying</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        {eachWay ? (
          <p className="text-xs text-muted-foreground">
            Each-way doubles total stake (win + place). Mark Placed when a selection finishes
            in the places but not first.
          </p>
        ) : null}

        <div className={cn(panelSurface, deskRunLegsPanelClass)}>
          <p className="text-sm font-medium">Selections ({legCount})</p>
          {legs.slice(0, legCount).map((leg, i) => (
            <div
              key={leg.id ?? `new-${i}`}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 text-xs tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <DeferredTextInput
                  className="min-w-0 flex-1"
                  placeholder={`Selection ${i + 1}`}
                  value={leg.label}
                  onCommit={(next) =>
                    setLegs((prev) =>
                      prev.map((l, j) => (j === i ? { ...l, label: next } : l))
                    )
                  }
                />
                <Input
                  className="w-24 shrink-0"
                  type="number"
                  min={1.01}
                  step={0.01}
                  placeholder="Odds"
                  value={Number.isFinite(leg.odds) ? leg.odds : ""}
                  onChange={(e) =>
                    setLegs((prev) =>
                      prev.map((l, j) =>
                        j === i ? { ...l, odds: parseFloat(e.target.value) } : l
                      )
                    )
                  }
                  disabled={moneyLocked}
                />
                <DateTimePicker
                  trigger="icon"
                  value={leg.scheduledAt}
                  onChange={(v) =>
                    setLegs((prev) =>
                      prev.map((l, j) => (j === i ? { ...l, scheduledAt: v } : l))
                    )
                  }
                  emptyLabel="Start time"
                />
              </div>
              <DeskLegEventFields
                events={events}
                disabled={moneyLocked}
                value={{
                  sport: leg.sport,
                  eventId: leg.eventId,
                  pendingFixture: leg.pendingFixture,
                  market: leg.market,
                  selection: leg.selection,
                }}
                onChange={(next) =>
                  setLegs((prev) =>
                    prev.map((l, j) => {
                      if (j !== i) return l;
                      const ev =
                        next.eventId != null
                          ? events.find((e) => e.id === next.eventId)
                          : undefined;
                      return {
                        ...l,
                        sport: next.sport,
                        eventId: next.eventId,
                        pendingFixture: next.pendingFixture,
                        market: next.market,
                        selection: next.selection,
                        label: nextDeskLegLabel({
                          currentLabel: l.label,
                          previousSelection: l.selection,
                          nextSelection: next.selection,
                          event: ev,
                        }),
                      };
                    })
                  )
                }
                onEventLinked={(hint) =>
                  setLegs((prev) =>
                    prev.map((l, j) =>
                      j === i
                        ? {
                            ...l,
                            scheduledAt:
                              l.scheduledAt ||
                              (hint.startTime != null
                                ? toDatetimeLocalValue(hint.startTime)
                                : ""),
                          }
                        : l
                    )
                  )
                }
              />
            </div>
          ))}
        </div>

        {preview != null && totalStake != null ? (
          <p className="text-xs text-muted-foreground">
            {preview.betCount} lines · total stake{" "}
            <span className="font-medium tabular-nums text-foreground">
              £{totalStake.toFixed(2)}
            </span>
            {eachWay ? " (EW)" : ""}
            {" · "}
            if all win (win part){" "}
            <MoneyFlow
              value={preview.profitIfAllWin}
              signColor
              signDisplay
              className="inline font-medium"
            />
          </p>
        ) : null}
      </div>
      </div>

      <DialogFooter>
        <Button {...pagePrimaryButtonProps} onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save system bet"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CreateSystemRunDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...pagePrimaryButtonProps} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New system bet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={deskRunDialogContentClass}>
          {open ? (
            <CreateSystemRunForm
              onDone={() => {
                setOpen(false);
                onCreated();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Card-footer Edit trigger for an existing Systems Desk run. */
export function EditSystemRunDialog({
  edit,
  onSaved,
}: {
  edit: SystemRunEdit;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={deskRunDialogContentClass}>
          {open ? (
            <CreateSystemRunForm
              key={`edit-${edit.run.id}-${edit.run.label}`}
              edit={edit}
              onDone={() => {
                setOpen(false);
                onSaved();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
