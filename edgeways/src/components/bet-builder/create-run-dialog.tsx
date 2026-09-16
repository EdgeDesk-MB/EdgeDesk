"use client";

import { useMemo, useState } from "react";
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
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { BetImportDialog } from "@/components/add-bet/bet-import-dialog";
import { DeferredTextInput } from "@/components/add-bet/deferred-text-input";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { summariseOcrFields } from "@/lib/ocr/parse-bet-screenshot";
import type { BetOcrFields } from "@/lib/ocr/types";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelInput,
  PanelSelect,
  PanelTextInput,
} from "@/components/calc/bet-panels";
import { DateTimePicker } from "@/components/date-time-picker";
import { DeskLegEventFields } from "@/components/desk/desk-leg-event-fields";
import { DeskRunDialogBody } from "@/components/desk/desk-run-dialog-body";
import { DeskStakeSource } from "@/components/desk/desk-stake-source";
import {
  OfferRequirementHint,
  OfferRequirementsNotice,
} from "@/components/offers/offer-requirements-notice";
import { nextDeskLegLabel } from "@/lib/desk/desk-leg-title";
import { resolveDeskEventIdForSave } from "@/lib/desk/resolve-desk-event-id";
import { usePauseAppStatePolling } from "@/components/app-state-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { wholeComboLay } from "@/lib/calc/bet-builder-workflow";
import {
  evaluatePlacementBreaches,
  placementBreachMessages,
  placementRequirementsFromImportant,
  placementRequirementsFromPrefill,
} from "@/lib/offers/offer-placement-requirements";
import { placementFieldWarningClass } from "@/lib/ui/surface-styles";
import { readImportantTerms, toDatetimeLocalValue } from "@/lib/offers/offer-terms";
import {
  emptySelectionCountFromPrefill,
  type BetBuilderRunPrefill,
} from "@/lib/bet-builder/bet-builder-run-prefill";
import { betBuilderRunMoneyLocked } from "@/lib/bet-builder/bet-builder-run-edit";
import { contrastText } from "@/lib/brands/exchanges";
import {
  normaliseDeskBackBetType,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import {
  partsKnownFixtureOption,
  type KnownFixtureOption,
} from "@/lib/add-bet-event-options";
import { MARKETS } from "@/lib/markets";
import type {
  BetBuilderRunRow,
  BetBuilderSelectionRow,
  EventRow,
  ExchangeRow,
} from "@/lib/db/schema";
import {
  deskRunDialogContentClass,
  deskRunLegsPanelClass,
  deskRunPanelClass,
} from "@/lib/ui/desk-run-dialog";
import { panelSurface } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

type SelDraft = { id?: number; label: string; market: string; selection: string };

export type BetBuilderRunEdit = {
  run: BetBuilderRunRow;
  selections: BetBuilderSelectionRow[];
  backBetType?: string | null;
};

function defaultMarketForSport(sport: string): string {
  return MARKETS[sport]?.[0]?.value ?? "other";
}

function eventDisplayName(ev: EventRow): string {
  if (ev.sport === "horse_racing" || ev.sport === "greyhounds") {
    return `${ev.competition ? `${ev.competition} · ` : ""}${ev.homeTeam}`;
  }
  return `${ev.homeTeam} v ${ev.awayTeam}`;
}

function pendingFixtureDisplayName(f: KnownFixtureOption): string {
  const parts = partsKnownFixtureOption(f);
  return parts.time ? `${parts.title} ${parts.time}` : parts.title;
}

function emptySelections(count: number, sport = "football"): SelDraft[] {
  const market = defaultMarketForSport(sport);
  return Array.from({ length: count }, () => ({ label: "", market, selection: "" }));
}


function selectionsFromEdit(edit: BetBuilderRunEdit): SelDraft[] {
  const sport = edit.run.sport?.trim() || "football";
  const defaultMarket = defaultMarketForSport(sport);
  return edit.selections.map((s) => ({
    id: s.id,
    label: s.label,
    market: s.market?.trim() || defaultMarket,
    selection: s.selection ?? "",
  }));
}

export function BetBuilderCreateRunForm({
  defaultExchange,
  prefill,
  edit,
  onDone,
}: {
  defaultExchange: ExchangeRow | null;
  prefill?: BetBuilderRunPrefill | null;
  edit?: BetBuilderRunEdit | null;
  onDone: () => void;
}) {
  const isEdit = edit != null;
  const moneyLocked = isEdit
    ? betBuilderRunMoneyLocked(edit.run, edit.selections)
    : false;
  usePauseAppStatePolling(true);
  const { state } = useAppState(0);
  const events = state?.events ?? [];

  const seedSport =
    prefill?.sport?.trim() ||
    edit?.run.sport?.trim() ||
    "football";

  const [label, setLabel] = useState(edit?.run.label ?? prefill?.label ?? "");
  const [method, setMethod] = useState<"combined" | "no_lay">(
    edit?.run.method ?? prefill?.suggestedMethod ?? "combined"
  );
  const [stake, setStake] = useState(edit?.run.stake ?? prefill?.stake ?? 10);
  const [backOdds, setBackOdds] = useState(edit?.run.backOdds ?? NaN);
  const [bookmaker, setBookmaker] = useState(
    edit?.run.bookmaker ?? prefill?.bookmaker ?? ""
  );
  const [backBetType, setBackBetType] = useState<DeskBackBetType>(() =>
    normaliseDeskBackBetType(
      edit?.backBetType ?? prefill?.backBetType ?? "qualifying"
    )
  );
  const [sport, setSport] = useState(seedSport);
  const [eventId, setEventId] = useState<number | null>(
    edit?.run.eventId ?? null
  );
  const [pendingFixture, setPendingFixture] = useState<KnownFixtureOption | null>(
    null
  );
  const [commissionPct, setCommissionPct] = useState(
    edit != null
      ? edit.run.commission * 100
      : (defaultExchange?.commissionPct ?? 0)
  );
  const [eventLabel, setEventLabel] = useState(
    edit?.run.eventLabel ?? prefill?.eventLabel ?? ""
  );
  const [scheduledAt, setScheduledAt] = useState(
    edit?.run.scheduledAt != null
      ? toDatetimeLocalValue(edit.run.scheduledAt)
      : ""
  );
  const [selections, setSelections] = useState<SelDraft[]>(() =>
    edit != null
      ? selectionsFromEdit(edit)
      : emptySelections(emptySelectionCountFromPrefill(prefill), seedSport)
  );
  const [layOdds, setLayOdds] = useState(NaN);
  const [layStake, setLayStake] = useState(NaN);
  const [layStakeTouched, setLayStakeTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const [prevPrefillSync, setPrevPrefillSync] = useState({ prefill, edit });
  if (prevPrefillSync.prefill !== prefill || prevPrefillSync.edit !== edit) {
    setPrevPrefillSync({ prefill, edit });
    if (!edit && prefill) {
      setLabel(prefill.label);
      setStake(prefill.stake);
      setBookmaker(prefill.bookmaker ?? "");
      setMethod(prefill.suggestedMethod ?? "combined");
      setBackBetType(normaliseDeskBackBetType(prefill.backBetType));
      const nextSport = prefill.sport?.trim() || "football";
      setSport(nextSport);
      setSelections(emptySelections(emptySelectionCountFromPrefill(prefill), nextSport));
      if (prefill.eventLabel) setEventLabel(prefill.eventLabel);
    }
  }

  const [prevExchangeSync, setPrevExchangeSync] = useState({ defaultExchange, edit });
  if (prevExchangeSync.defaultExchange !== defaultExchange || prevExchangeSync.edit !== edit) {
    setPrevExchangeSync({ defaultExchange, edit });
    if (edit == null && defaultExchange != null) {
      setCommissionPct(defaultExchange.commissionPct);
    }
  }

  const commission = Number.isFinite(commissionPct) ? commissionPct / 100 : 0;
  const laySuggestion = useMemo(
    () =>
      !isEdit &&
      method === "combined" &&
      stake > 0 &&
      backOdds > 1 &&
      layOdds > 1
        ? wholeComboLay({
            stake,
            combinedOdds: backOdds,
            layOdds,
            commission,
          })
        : null,
    [isEdit, method, stake, backOdds, layOdds, commission]
  );

  const [prevLaySuggestion, setPrevLaySuggestion] = useState<{
    current: typeof laySuggestion;
  } | null>(null);
  if (prevLaySuggestion === null || prevLaySuggestion.current !== laySuggestion) {
    setPrevLaySuggestion({ current: laySuggestion });
    if (!layStakeTouched && laySuggestion != null) setLayStake(laySuggestion.layStake);
  }

  const validSelections = selections.filter((s) => s.label.trim());
  const offerRequirements = (() => {
    if (prefill) return placementRequirementsFromPrefill(prefill);
    const offerId = edit?.run.offerId;
    if (offerId == null) return null;
    const offer = state?.offers?.find((o) => o.id === offerId);
    if (!offer) return null;
    return placementRequirementsFromImportant(readImportantTerms(offer), {
      purpose: backBetType === "free_snr" || backBetType === "free_sr" ? "convert" : "qualify",
      includeSelections: true,
    });
  })();
  const requirementBreaches = evaluatePlacementBreaches(offerRequirements, {
    odds: backOdds,
    stake,
    selectionCount: validSelections.length,
  });
  const canSave =
    label.trim().length > 0 &&
    stake > 0 &&
    backOdds > 1 &&
    validSelections.length >= 2;

  function applyOcr(fields: BetOcrFields) {
    if (isEdit) return;
    if (fields.bookmaker) setBookmaker(fields.bookmaker);
    if (fields.backStake != null && fields.backStake > 0) setStake(fields.backStake);
    if (fields.backOdds != null && fields.backOdds > 1) setBackOdds(fields.backOdds);
    if (fields.eventName) setEventLabel(fields.eventName);
    if (fields.isFreeBet) setBackBetType("free_snr");
    if (fields.structure === "bet_builder" || fields.structure === "accumulator") {
      /* keep method */
    }
    if (fields.legs && fields.legs.length >= 2) {
      setSelections(
        fields.legs.map((leg) => ({
          label: leg.label,
          market: defaultMarketForSport(sport),
          selection: "",
        }))
      );
      if (!label.trim()) {
        setLabel(fields.legs.slice(0, 3).map((l) => l.label).join(" / "));
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
      const resolvedEventId = await resolveDeskEventIdForSave({
        eventId,
        pendingFixture,
      });
      const selPayload = validSelections.map((s) => ({
        ...(s.id != null ? { id: s.id } : {}),
        label: s.label.trim(),
        market: s.market || null,
        selection: s.selection.trim() || null,
      }));
      if (isEdit && edit) {
        await api(`/api/bet-builder/${edit.run.id}`, {
          method: "PATCH",
          json: {
            label: label.trim(),
            bookmaker: bookmaker.trim() || null,
            stake,
            backOdds,
            commission,
            backBetType,
            sport,
            eventId: resolvedEventId,
            eventLabel: eventLabel.trim() || null,
            scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : null,
            selections: selPayload,
          },
        });
        toast.success("Bet builder updated");
      } else {
        const includeLay =
          method === "combined" && layOdds > 1 && layStake > 0
            ? {
                layOdds,
                layStake,
                exchangeId: defaultExchange?.id ?? null,
              }
            : null;
        await api("/api/bet-builder", {
          method: "POST",
          json: {
            label: label.trim(),
            method,
            stake,
            backOdds,
            bookmaker: bookmaker.trim() || null,
            commission,
            offerId: prefill?.offerId ?? null,
            backBetType,
            sport,
            eventId: resolvedEventId,
            eventLabel: eventLabel.trim() || null,
            scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : null,
            selections: selPayload.map(({ id: _id, ...rest }) => rest),
            wholeLay: includeLay,
          },
        });
        toast.success("Bet builder saved", {
          description:
            backBetType === "free_snr" || backBetType === "free_sr"
              ? "Free-bet convert is in the tracker."
              : method === "no_lay"
                ? "Back only, settle when the builder lands."
                : includeLay
                  ? `Combined lay logged · £${layStake.toFixed(2)} @ ${layOdds.toFixed(2)}.`
                  : "Log the combined lay when ready.",
        });
      }
      onDone();
    } catch (e) {
      toast.error(isEdit ? "Could not update bet builder" : "Could not save bet builder", {
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
            ? "Edit bet builder"
            : prefill?.purpose === "convert"
              ? "Convert on Bet Builder"
              : "New bet builder"}
        </DialogTitle>
        <DialogDescription
          explainer={
            isEdit && moneyLocked ? (
              <DialogExplainer title="What you can edit">
                Label, bookmaker, event and selections. Stake and odds stay
                locked.
              </DialogExplainer>
            ) : undefined
          }
        >
          {isEdit
            ? moneyLocked
              ? "Stake and odds stay locked."
              : "Update the builder details."
            : "Same-event selections, one kick-off."}
        </DialogDescription>
      </DialogHeader>
      <DeskRunDialogBody>

      <OfferRequirementsNotice
        requirements={offerRequirements}
        breaches={requirementBreaches}
      />

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
          label="Bet builder"
          value={label}
          onChange={setLabel}
          placeholder="e.g. Betfair weekly BB"
        />
        <PanelSelect
          label="Method"
          value={method}
          onChange={(v) => setMethod(v as "combined" | "no_lay")}
          disabled={isEdit}
        >
          <option value="combined">Combined lay</option>
          <option value="no_lay">No lay (back only)</option>
        </PanelSelect>
        <p className="text-xs font-medium text-black/60 dark:text-white/70">
          {method === "no_lay"
            ? "Back only, common for hard-to-lay builders and some free-bet clears."
            : "One equalising lay at the exchange (optional below if you already placed it)."}
        </p>
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
        <PanelTextInput
          label="Event"
          value={eventLabel}
          onChange={setEventLabel}
          placeholder="e.g. Arsenal v Chelsea"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-black/60 dark:text-white/70">
            Kick-off
          </span>
          <DateTimePicker value={scheduledAt} onChange={setScheduledAt} />
        </div>
        <DeskLegEventFields
          events={events}
          showMarketSelection={false}
          value={{
            sport,
            eventId,
            pendingFixture,
            market: "",
            selection: "",
          }}
          onChange={(next) => {
            setSport(next.sport);
            setEventId(next.eventId);
            setPendingFixture(next.pendingFixture);
            if (!eventLabel.trim()) {
              if (next.pendingFixture) {
                setEventLabel(pendingFixtureDisplayName(next.pendingFixture));
              } else if (next.eventId != null) {
                const ev = events.find((e) => e.id === next.eventId);
                if (ev) setEventLabel(eventDisplayName(ev));
              }
            }
            setSelections((prev) =>
              prev.map((s) => ({
                ...s,
                market: defaultMarketForSport(next.sport),
                selection: "",
              }))
            );
          }}
          onEventLinked={(hint) => {
            if (!scheduledAt && hint.startTime != null) {
              setScheduledAt(toDatetimeLocalValue(hint.startTime));
            }
          }}
        />
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <PanelInput
            label="Back stake"
            prefix="£"
            value={stake}
            onChange={setStake}
            min={0.01}
            placeholder="10.00"
            disabled={moneyLocked}
            invalid={requirementBreaches.stakeLow || requirementBreaches.stakeHigh}
            describedBy="bb-offer-req"
            inputClassName={
              requirementBreaches.stakeLow || requirementBreaches.stakeHigh
                ? placementFieldWarningClass
                : undefined
            }
          />
          <PanelInput
            label="BB odds"
            value={backOdds}
            onChange={setBackOdds}
            min={1.01}
            step={0.01}
            placeholder="Bookie price"
            disabled={moneyLocked}
            invalid={requirementBreaches.oddsLow}
            describedBy="bb-offer-req"
            inputClassName={
              requirementBreaches.oddsLow ? placementFieldWarningClass : undefined
            }
          />
        </div>
        <OfferRequirementHint
          id="bb-offer-req"
          messages={placementBreachMessages(offerRequirements, {
            ...requirementBreaches,
            selectionsLow: false,
          })}
        />
      </BackPanel>

      {method === "combined" ? (
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
          {!isEdit ? (
            <>
              <PanelInput
                label="Lay odds (optional)"
                value={layOdds}
                onChange={setLayOdds}
                min={1.01}
                step={0.01}
                placeholder="Exchange"
                exchangeOddsStepping
              />
              <LayStakeBanner
                label="Lay stake (optional)"
                value={Number.isFinite(layStake) ? layStake : 0}
                onChange={(v) => {
                  setLayStakeTouched(true);
                  setLayStake(v);
                }}
              />
              {laySuggestion != null && !layStakeTouched ? (
                <p className="text-xs font-medium text-black/60 dark:text-white/70">
                  Suggested equalising stake £{laySuggestion.layStake.toFixed(2)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs font-medium text-black/60 dark:text-white/70">
              {moneyLocked
                ? "Lay already logged on the desk. Commission stays locked with the placed lay."
                : "Log or change the combined lay on the desk card when ready."}
            </p>
          )}
        </LayPanel>
      ) : null}

      <div className={cn(panelSurface, deskRunLegsPanelClass)}>
        <p className="text-xs font-semibold text-foreground">Selections</p>
        {requirementBreaches.selectionsLow ? (
          <OfferRequirementHint
            messages={placementBreachMessages(offerRequirements, {
              ...requirementBreaches,
              oddsLow: false,
              stakeLow: false,
              stakeHigh: false,
            })}
          />
        ) : null}
        {selections.map((sel, i) => (
          <div
            key={sel.id ?? `new-${i}`}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 p-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <DeferredTextInput
                className="h-8 min-w-0 flex-1"
                value={sel.label}
                onCommit={(next) =>
                  setSelections((prev) =>
                    prev.map((s, j) => (j === i ? { ...s, label: next } : s))
                  )
                }
                placeholder={`Selection ${i + 1}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0"
                onClick={() =>
                  setSelections((prev) =>
                    prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)
                  )
                }
                disabled={selections.length <= 2 || moneyLocked}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <DeskLegEventFields
              events={events}
              showSportEvent={false}
              value={{
                sport,
                eventId,
                pendingFixture,
                market: sel.market,
                selection: sel.selection,
              }}
              disabled={moneyLocked}
              onChange={(next) =>
                setSelections((prev) =>
                  prev.map((s, j) => {
                    if (j !== i) return s;
                    const ev =
                      eventId != null
                        ? events.find((e) => e.id === eventId)
                        : undefined;
                    return {
                      ...s,
                      market: next.market,
                      selection: next.selection,
                      label: nextDeskLegLabel({
                        currentLabel: s.label,
                        previousSelection: s.selection,
                        nextSelection: next.selection,
                        event: ev,
                      }),
                    };
                  })
                )
              }
            />
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              setSelections((prev) => [
                ...prev,
                ...emptySelections(1, sport),
              ])
            }
            disabled={selections.length >= 12 || moneyLocked}
          >
            <Plus className="size-3.5" /> Add selection
          </Button>
        </div>
      </div>
      </DeskRunDialogBody>

      <DialogFooter>
        <Button
          type="button"
          {...pagePrimaryButtonProps}
          disabled={!canSave || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : "Save bet builder"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CreateBetBuilderRunDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const { defaultExchange } = useExchanges();
  return (
    <>
      <Button {...pagePrimaryButtonProps} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New bet builder
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={deskRunDialogContentClass}>
          <BetBuilderCreateRunForm
            defaultExchange={defaultExchange}
            onDone={() => {
              setOpen(false);
              onCreated?.();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BetBuilderRunCreateDialog({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: BetBuilderRunPrefill;
  onCreated?: () => void;
}) {
  const { defaultExchange } = useExchanges();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={deskRunDialogContentClass}>
        {open ? (
          <BetBuilderCreateRunForm
            key={prefill?.offerId ?? "new"}
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

/** Card-footer Edit trigger for an existing Bet Builder Desk run. */
export function EditBetBuilderRunDialog({
  edit,
  onSaved,
}: {
  edit: BetBuilderRunEdit;
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
            <BetBuilderCreateRunForm
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
