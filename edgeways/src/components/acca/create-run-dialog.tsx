"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { BetImportDialog } from "@/components/add-bet/bet-import-dialog";
import { DeferredTextInput } from "@/components/add-bet/deferred-text-input";
import { deskLegsFromOcrSlip } from "@/lib/ocr/apply-desk-slip-legs";
import { summariseOcrFields } from "@/lib/ocr/parse-bet-screenshot";
import type { BetOcrFields } from "@/lib/ocr/types";
import { NumField } from "@/components/calc/num-field";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import {
  BackPanel,
  LayPanel,
  PanelInput,
  PanelSelect,
  PanelTextInput,
} from "@/components/calc/bet-panels";
import { DateTimePicker } from "@/components/date-time-picker";
import { DeskLegEventFields } from "@/components/desk/desk-leg-event-fields";
import { DeskRunDialogBody } from "@/components/desk/desk-run-dialog-body";
import { DeskStakeSource } from "@/components/desk/desk-stake-source";
import { nextDeskLegLabel } from "@/lib/desk/desk-leg-title";
import { resolveDeskEventIdForSave } from "@/lib/desk/resolve-desk-event-id";
import { usePauseAppStatePolling } from "@/components/app-state-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { useKnownFixtures } from "@/hooks/use-known-fixtures";
import { applyAccaBoost } from "@/lib/calc/acca-workflow";
import {
  emptyLegCountFromPrefill,
  type AccaRunPrefill,
} from "@/lib/acca/acca-run-prefill";
import { AccaMethodHelpDialog } from "@/components/acca/method-help-dialog";
import { ExchangeFundingNotice } from "@/components/acca/exchange-funding-notice";
import { WarningNotice } from "@/components/ui/warning-notice";
import { accaExchangeFundingModel } from "@/lib/acca/exchange-funding-model";
import { formatGbp } from "@/lib/format-money";
import { ACCA_METHOD_HELP } from "@/content/help/acca-methods";
import { accaRunMoneyLocked } from "@/lib/acca/acca-run-edit";
import { contrastText } from "@/lib/brands/exchanges";
import {
  normaliseDeskBackBetType,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import type { KnownFixtureOption } from "@/lib/add-bet-event-options";
import { MARKETS } from "@/lib/markets";
import { toDatetimeLocalValue } from "@/lib/offers/offer-terms";
import type { AccaLegRow, AccaRunRow, ExchangeRow } from "@/lib/db/schema";
import {
  deskRunDialogContentClass,
  deskRunLegsPanelClass,
  deskRunPanelClass,
} from "@/lib/ui/desk-run-dialog";
import { panelSurface } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

type LegDraft = {
  id?: number;
  label: string;
  backOdds: number;
  scheduledAt: string;
  sport: string;
  eventId: number | null;
  pendingFixture: KnownFixtureOption | null;
  market: string;
  selection: string;
};

export type AccaRunEdit = {
  run: AccaRunRow;
  legs: AccaLegRow[];
  backBetType?: string | null;
};

function defaultMarketForSport(sport: string): string {
  return MARKETS[sport]?.[0]?.value ?? "other";
}

function emptyLegs(count: number, sport = "football"): LegDraft[] {
  const market = defaultMarketForSport(sport);
  return Array.from({ length: count }, () => ({
    label: "",
    backOdds: NaN,
    scheduledAt: "",
    sport,
    eventId: null,
    pendingFixture: null,
    market,
    selection: "",
  }));
}

function RequirementsStrip({ prefill }: { prefill: AccaRunPrefill }) {
  const parts: string[] = [];
  if (prefill.purpose === "convert") parts.push("Free-bet convert");
  if (prefill.minSelections != null) parts.push(`Min ${prefill.minSelections} selections`);
  if (prefill.minOdds != null) parts.push(`Min odds ${prefill.minOdds}`);
  if (prefill.minStake != null) parts.push(`Min stake ${formatGbp(prefill.minStake)}`);
  if (prefill.maxStake != null) parts.push(`Max stake ${formatGbp(prefill.maxStake)}`);
  const notes = prefill.importantNotes?.trim();
  if (notes) {
    const short = notes.length > 160 ? `${notes.slice(0, 157)}…` : notes;
    parts.push(short);
  }
  if (parts.length === 0) return null;
  return (
    <WarningNotice
      title={prefill.purpose === "convert" ? "Reward requirements" : "Offer requirements"}
    >
      <p>{parts.join(" · ")}</p>
    </WarningNotice>
  );
}

function legsFromEdit(edit: AccaRunEdit): LegDraft[] {
  return edit.legs.map((l) => {
    const sport = l.sport?.trim() || "football";
    return {
      id: l.id,
      label: l.label,
      backOdds: l.backOdds,
      scheduledAt: l.scheduledAt != null ? toDatetimeLocalValue(l.scheduledAt) : "",
      sport,
      eventId: l.eventId ?? null,
      pendingFixture: null,
      market: l.market?.trim() || defaultMarketForSport(sport),
      selection: l.selection ?? "",
    };
  });
}

export function CreateRunForm({
  defaultExchange,
  prefill,
  edit,
  onDone,
}: {
  defaultExchange: ExchangeRow | null;
  prefill?: AccaRunPrefill | null;
  edit?: AccaRunEdit | null;
  onDone: () => void;
}) {
  const isEdit = edit != null;
  const moneyLocked = isEdit ? accaRunMoneyLocked(edit.run, edit.legs) : false;
  // Form only mounts while the dialog is open — pause /api/state so typing stays snappy.
  usePauseAppStatePolling(true);
  const { state } = useAppState(0);
  const events = state?.events ?? [];
  const { fixtures: racingFixtures } = useKnownFixtures("horse_racing");

  const [label, setLabel] = useState(edit?.run.label ?? prefill?.label ?? "");
  const [method, setMethod] = useState<AccaRunRow["method"]>(
    edit?.run.method ?? prefill?.suggestedMethod ?? "sequential"
  );
  const [stake, setStake] = useState(edit?.run.stake ?? prefill?.stake ?? 10);
  const [bookmaker, setBookmaker] = useState(
    edit?.run.bookmaker ?? prefill?.bookmaker ?? ""
  );
  const [backBetType, setBackBetType] = useState<DeskBackBetType>(() =>
    normaliseDeskBackBetType(
      edit?.backBetType ?? prefill?.backBetType ?? "qualifying"
    )
  );
  const [commissionPct, setCommissionPct] = useState(
    edit != null
      ? edit.run.commission * 100
      : (defaultExchange?.commissionPct ?? 0)
  );
  const [refundAmount, setRefundAmount] = useState(
    edit?.run.refundAmount ?? NaN
  );
  const [boosted, setBoosted] = useState(
    edit != null ? edit.run.boostPct != null && edit.run.boostPct > 0 : false
  );
  const [boostPct, setBoostPct] = useState(edit?.run.boostPct ?? NaN);
  const [noLay, setNoLay] = useState(edit != null ? edit.run.noLay === 1 : false);
  const [legs, setLegs] = useState<LegDraft[]>(() =>
    edit != null
      ? legsFromEdit(edit)
      : emptyLegs(
          emptyLegCountFromPrefill(prefill),
          prefill?.sport?.trim() || "football"
        )
  );
  const [saving, setSaving] = useState(false);

  const [prevPrefillSync, setPrevPrefillSync] = useState({ prefill, edit });
  if (prevPrefillSync.prefill !== prefill || prevPrefillSync.edit !== edit) {
    setPrevPrefillSync({ prefill, edit });
    if (!edit && prefill) {
      setLabel(prefill.label);
      setStake(prefill.stake);
      setBookmaker(prefill.bookmaker ?? "");
      setMethod(prefill.suggestedMethod ?? "sequential");
      setBackBetType(normaliseDeskBackBetType(prefill.backBetType));
      setLegs(
        emptyLegs(
          emptyLegCountFromPrefill(prefill),
          prefill.sport?.trim() || "football"
        )
      );
    }
  }

  const [prevExchangeSync, setPrevExchangeSync] = useState({ defaultExchange, edit });
  if (prevExchangeSync.defaultExchange !== defaultExchange || prevExchangeSync.edit !== edit) {
    setPrevExchangeSync({ defaultExchange, edit });
    if (edit == null && defaultExchange != null) {
      setCommissionPct(defaultExchange.commissionPct);
    }
  }

  const methodHelp = ACCA_METHOD_HELP[method];
  const showLayPanel = method === "combined" ? !noLay : true;

  const validLegs = legs.filter((l) => l.label.trim() && l.backOdds > 1);
  const rawCombinedOdds = validLegs.reduce((a, l) => a * l.backOdds, 1);
  const combinedOdds = applyAccaBoost(rawCombinedOdds, boosted && boostPct > 0 ? boostPct : null);
  const canSave = label.trim().length > 0 && stake > 0 && validLegs.length >= 2;
  const funding = accaExchangeFundingModel({
    method,
    stake,
    commission: Number.isFinite(commissionPct) ? commissionPct / 100 : 0,
    boostPct: boosted && boostPct > 0 ? boostPct : null,
    legs: validLegs.map((l, i) => ({
      seq: i + 1,
      label: l.label.trim(),
      backOdds: l.backOdds,
      result: "pending",
      layStake: null,
      layOdds: null,
    })),
    accounts: state?.balances?.accounts,
    exchangeId: defaultExchange?.id ?? null,
  });

  function applyOcr(fields: BetOcrFields) {
    if (isEdit) return;
    if (fields.bookmaker) setBookmaker(fields.bookmaker);
    if (fields.backStake != null && fields.backStake > 0) setStake(fields.backStake);
    if (fields.isFreeBet) setBackBetType("free_snr");
    const seedSport = prefill?.sport?.trim() || legs[0]?.sport || "football";
    if (
      fields.structure === "double" ||
      fields.structure === "treble" ||
      fields.structure === "four_fold" ||
      fields.structure === "accumulator"
    ) {
      // Straight multiples belong on Acca Desk; keep current method.
    }
    if (fields.legs && fields.legs.length >= 2) {
      const next = deskLegsFromOcrSlip(fields.legs, {
        events,
        fixtures: racingFixtures,
        seedSport,
      });
      setLegs(next);
      if (!label.trim()) {
        setLabel(next.slice(0, 3).map((l) => l.label).join(" / "));
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
    setSaving(true);
    try {
      const resolved = await Promise.all(
        validLegs.map(async (l) => ({
          ...(l.id != null ? { id: l.id } : {}),
          label: l.label.trim(),
          backOdds: l.backOdds,
          scheduledAt: l.scheduledAt ? new Date(l.scheduledAt).getTime() : null,
          eventId: await resolveDeskEventIdForSave({
            eventId: l.eventId,
            pendingFixture: l.pendingFixture,
          }),
          sport: l.sport,
          market: l.market || null,
          selection: l.selection.trim() || null,
        }))
      );
      const legPayload = resolved;
      if (isEdit && edit) {
        await api(`/api/acca/${edit.run.id}`, {
          method: "PATCH",
          json: {
            label: label.trim(),
            bookmaker: bookmaker.trim() || null,
            stake,
            commission: Number.isFinite(commissionPct) ? commissionPct / 100 : 0,
            refundAmount:
              method !== "sequential" &&
              method !== "combined" &&
              Number.isFinite(refundAmount)
                ? refundAmount
                : null,
            boostPct: boosted && boostPct > 0 ? boostPct : null,
            backBetType,
            legs: legPayload,
          },
        });
        toast.success("Acca run updated");
      } else {
        await api("/api/acca", {
          method: "POST",
          json: {
            label: label.trim(),
            method,
            stake,
            bookmaker: bookmaker.trim() || null,
            commission: Number.isFinite(commissionPct) ? commissionPct / 100 : 0,
            offerId: prefill?.offerId ?? null,
            backBetType,
            refundAmount:
              method !== "sequential" &&
              method !== "combined" &&
              Number.isFinite(refundAmount)
                ? refundAmount
                : null,
            boostPct: boosted && boostPct > 0 ? boostPct : null,
            noLay: method === "combined" ? noLay : false,
            legs: legPayload.map(({ id: _id, ...rest }) => rest),
          },
        });
        toast.success("Acca run created", {
          description:
            backBetType === "free_snr" || backBetType === "free_sr"
              ? "Free-bet convert is in the tracker."
              : "The back bet is in the tracker.",
        });
      }
      onDone();
    } catch (e) {
      toast.error(isEdit ? "Could not update run" : "Could not create run", {
        description: String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit
            ? "Edit acca"
            : prefill?.purpose === "convert"
              ? "Convert on Acca Desk"
              : "New acca"}
        </DialogTitle>
        <DialogDescription
          explainer={
            isEdit && moneyLocked ? (
              <DialogExplainer title="What you can edit">
                Label, bookmaker, legs and start times. Stake and odds stay
                locked.
              </DialogExplainer>
            ) : undefined
          }
        >
          {isEdit
            ? moneyLocked
              ? "Stake and odds stay locked."
              : "Update the run details."
            : prefill?.purpose === "convert"
              ? "Log the free-bet acca, then lay."
              : "Log the acca, then lay each leg."}
        </DialogDescription>
      </DialogHeader>
      <DeskRunDialogBody>

      {prefill && !isEdit ? <RequirementsStrip prefill={prefill} /> : null}

      {!isEdit ? (
        <BetImportDialog onApply={(fields) => applyOcr(fields)} />
      ) : null}

      <BackPanel
        title="Back Bet"
        exchange={defaultExchange}
        venue={bookmaker}
        className={deskRunPanelClass}
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
          disabled={isEdit}
        >
          <option value="sequential">{ACCA_METHOD_HELP.sequential.label}</option>
          <option value="insurance_legs">{ACCA_METHOD_HELP.insurance_legs.label}</option>
          <option value="insurance_whole">{ACCA_METHOD_HELP.insurance_whole.label}</option>
          <option value="combined">{ACCA_METHOD_HELP.combined.label}</option>
        </PanelSelect>
        <p className="text-xs font-medium text-black/60 dark:text-white/70">
          {methodHelp.blurb}{" "}
          <AccaMethodHelpDialog focus={method} />
        </p>
        {method === "combined" && !isEdit ? (
          <label className="flex items-center gap-2 text-[12px] font-medium text-black/70 dark:text-white/80">
            <input
              type="checkbox"
              checked={noLay}
              onChange={(e) => setNoLay(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            No lay (back only)
          </label>
        ) : null}
        <DeskStakeSource
          bookmaker={bookmaker}
          value={backBetType}
          onChange={setBackBetType}
          stake={stake}
          disabled={moneyLocked}
          onStakeFill={(amount) => {
            if (amount > 0) setStake(amount);
          }}
        />
        <PanelInput
          label="Back stake"
          prefix="£"
          value={stake}
          onChange={setStake}
          min={0.01}
          placeholder="10.00"
          disabled={moneyLocked}
        />
        {method === "insurance_legs" || method === "insurance_whole" ? (
          <PanelInput
            label="Refund free bet"
            prefix="£"
            value={refundAmount}
            onChange={setRefundAmount}
            min={0}
            placeholder="e.g. 10"
            disabled={moneyLocked}
          />
        ) : null}
        {method === "insurance_legs" || method === "insurance_whole" ? (
          <p className="text-xs font-medium text-black/60 dark:text-white/70">
            Refund awarded when exactly one leg loses
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-xs font-semibold text-black/60 dark:text-white/70">
          <input
            type="checkbox"
            checked={boosted}
            onChange={(e) => setBoosted(e.target.checked)}
            className="size-3.5 accent-black/70 dark:accent-white/80"
            disabled={moneyLocked}
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
              disabled={moneyLocked}
            />
            <p className="text-xs font-medium text-black/60 dark:text-white/70">
              Boosts your winnings only, not the stake return - e.g. a 50% boost on 3.0 combined
              odds pays out at 4.0, not 4.5
            </p>
          </>
        ) : null}
      </BackPanel>

      {showLayPanel ? (
        <LayPanel
          title="Lay Bet"
          exchange={defaultExchange}
          className={deskRunPanelClass}
          chip={
            defaultExchange ? (
              <span
                className="rounded px-2 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: defaultExchange.brandColor,
                  color: contrastText(defaultExchange.brandColor),
                }}
              >
                {defaultExchange.name.toUpperCase()}
              </span>
            ) : null
          }
        >
          <PanelInput
            label="Exchange commission"
            suffix="%"
            value={commissionPct}
            onChange={setCommissionPct}
            min={0}
            step={0.5}
            placeholder="2.00"
            disabled={moneyLocked}
          />
          <p className="text-xs font-medium text-black/60 dark:text-white/70">
            {method === "combined" || method === "insurance_whole"
              ? "Log the combined lay on the desk when you place it."
              : "The desk tells you when and how much to lay for each leg."}
          </p>
        </LayPanel>
      ) : null}

      <div className={cn(panelSurface, deskRunLegsPanelClass)}>
        <Label className="text-xs text-muted-foreground">Legs (in play order)</Label>
        {legs.map((leg, i) => (
          <div
            key={leg.id ?? `new-${i}`}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 p-3"
          >
            <div className="flex min-w-0 items-end gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <DeferredTextInput
                  value={leg.label}
                  onCommit={(next) =>
                    setLegs((prev) =>
                      prev.map((l, j) => (j === i ? { ...l, label: next } : l))
                    )
                  }
                  placeholder={`Leg ${i + 1}`}
                  aria-label={`Leg ${i + 1} label`}
                />
              </div>
              <NumField
                label="Odds"
                value={leg.backOdds}
                onChange={(v) =>
                  setLegs((prev) =>
                    prev.map((l, j) => (j === i ? { ...l, backOdds: v } : l))
                  )
                }
                min={1.01}
                step={0.01}
                className="w-20 shrink-0"
                disabled={moneyLocked}
              />
              <LegStartField
                value={leg.scheduledAt}
                onChange={(v) =>
                  setLegs((prev) =>
                    prev.map((l, j) => (j === i ? { ...l, scheduledAt: v } : l))
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground"
                aria-label={`Remove leg ${i + 1}`}
                disabled={legs.length <= 2 || moneyLocked}
                onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <DeskLegEventFields
              events={events}
              scopeCourse={isEdit ? undefined : prefill?.scopeCourse}
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
                          // Kick-off only — never fill the leg label with the
                          // race/fixture title (that is not what was backed).
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
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              setLegs([
                ...legs,
                ...emptyLegs(1, legs[legs.length - 1]?.sport || "football"),
              ])
            }
            disabled={legs.length >= 12 || moneyLocked}
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
      {funding ? <ExchangeFundingNotice model={funding} /> : null}
      </DeskRunDialogBody>

      <DialogFooter>
        <Button
          {...pagePrimaryButtonProps}
          onClick={() => void save()}
          disabled={saving || !canSave}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create run"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Icon-only leg start picker: DateTimePicker (calendar + time wheels). */
function LegStartField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <DateTimePicker
      trigger="icon"
      value={value}
      onChange={onChange}
      emptyLabel="Start time"
    />
  );
}

/** Page-header "New run" trigger used on Acca Desk. */
export function CreateRunDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  // Loaded here (not inside CreateRunForm) so the Acca Bet panel already has
  // the user's default exchange colour by the time the dialog first opens.
  const { defaultExchange } = useExchanges();
  return (
    <>
      <Button {...pagePrimaryButtonProps} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New run
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={deskRunDialogContentClass}>
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
    </>
  );
}

/** Controlled dialog for the global AccaRunProvider. */
export function AccaRunCreateDialog({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: AccaRunPrefill | null;
  onCreated?: () => void;
}) {
  const { defaultExchange } = useExchanges();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={deskRunDialogContentClass}>
        {open ? (
          <CreateRunForm
            key={prefill?.offerId ?? "standalone"}
            defaultExchange={defaultExchange}
            prefill={prefill}
            onDone={() => {
              onOpenChange(false);
              onCreated?.();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Card-footer Edit trigger for an existing Acca Desk run. */
export function EditAccaRunDialog({
  edit,
  onSaved,
}: {
  edit: AccaRunEdit;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { defaultExchange } = useExchanges();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" /> Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={deskRunDialogContentClass}>
          {open ? (
            <CreateRunForm
              key={`edit-${edit.run.id}-${edit.run.label}`}
              defaultExchange={defaultExchange}
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
