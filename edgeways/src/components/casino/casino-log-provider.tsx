"use client";

/**
 * Global "Log a casino offer" dialog (H2/K1) - openable from the side-nav quick
 * action on any page, mirroring the add-bet / matched-calculator providers.
 *
 * Flow:
 * 1. Name the campaign (casino, title, expiry, optional repeats).
 * 2. Add steps. Paste/OCR of "Wager £X get …" campaigns goes through
 *    qualifying wager first, then "Next step" for the bonus/spins reward.
 *    Single-reward pastes (or manual entry) still use one step.
 *
 * K3: repeats can be enabled on step 1; sealing the series template happens
 * when components are saved (and re-syncs if further steps are added).
 *
 * Saving fires CASINO_CHANGED_EVENT so the Casino page refreshes if mounted.
 */

import { createContext, useCallback, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker, formatYmdLocal } from "@/components/date-picker";
import { EventTimeInput } from "@/components/event-time-input";
import { CasinoComponentForm } from "@/components/casino/casino-component-form";
import { CasinoPasteDialog } from "@/components/casino/casino-paste-dialog";
import { CASINO_CHANGED_EVENT } from "@/components/casino/casino-ui";
import {
  DEFAULT_RECURRENCE_FIELDS,
  RecurrenceRuleFields,
  buildRecurrenceRule,
  type RecurrenceRuleFieldsValue,
} from "@/components/offers/recurrence-rule-fields";
import { VenueSelect } from "@/components/venue-select";
import { api } from "@/hooks/use-app-state";
import type { CasinoComponentType } from "@/lib/calc/casino-reward-ev";
import { fromDatetimeLocalValue } from "@/lib/offers/offer-terms";
import { localYmd, parseYmd } from "@/lib/offers/offer-recurrence-shared";
import {
  draftNeedsQualifyThenReward,
  type ParsedCasinoOfferDraft,
} from "@/lib/offers/parse-casino-offer-text";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

/** Combine upgraded date/time pickers into epoch ms (date-only → 23:59). */
function expiresAtFromParts(date: string, time: string): number | null {
  if (!date.trim()) return null;
  const hhmm = time.trim() || "23:59";
  return fromDatetimeLocalValue(`${date.trim()}T${hhmm}`);
}

function defaultExpiresDate(): string {
  return formatYmdLocal(new Date());
}

const DEFAULT_EXPIRES_TIME = "23:59";

type StepPhase = "qualify" | "reward";

/** Game / RTP carried from the qualifying step into the reward step. */
type CarriedStepDefaults = {
  rtp: number | null;
  game: string | null;
};

type CasinoLogContextValue = {
  openCasinoLog: () => void;
};

const CasinoLogContext = createContext<CasinoLogContextValue | null>(null);

export function useCasinoLog() {
  const ctx = useContext(CasinoLogContext);
  if (!ctx) throw new Error("useCasinoLog must be used within CasinoLogProvider");
  return ctx;
}

function rewardStepType(draft: ParsedCasinoOfferDraft | null): CasinoComponentType {
  return draft?.likelyComponentType ?? "bonus";
}

export function CasinoLogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [casino, setCasino] = useState("");
  const [title, setTitle] = useState("");
  const [expiresDate, setExpiresDate] = useState(defaultExpiresDate);
  const [expiresTime, setExpiresTime] = useState(DEFAULT_EXPIRES_TIME);
  const [saving, setSaving] = useState(false);
  const [createdOfferId, setCreatedOfferId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ParsedCasinoOfferDraft | null>(null);
  const [stepPhase, setStepPhase] = useState<StepPhase>("reward");
  const [carriedStep, setCarriedStep] = useState<CarriedStepDefaults | null>(null);
  const [repeatsEnabled, setRepeatsEnabled] = useState(false);
  const [repeatFields, setRepeatFields] =
    useState<RecurrenceRuleFieldsValue>(DEFAULT_RECURRENCE_FIELDS);

  const openCasinoLog = useCallback(() => {
    setExpiresDate(defaultExpiresDate());
    setExpiresTime(DEFAULT_EXPIRES_TIME);
    setOpen(true);
  }, []);

  function resetForm() {
    setCasino("");
    setTitle("");
    setExpiresDate(defaultExpiresDate());
    setExpiresTime(DEFAULT_EXPIRES_TIME);
    setCreatedOfferId(null);
    setDraft(null);
    setStepPhase("reward");
    setCarriedStep(null);
    setRepeatsEnabled(false);
    setRepeatFields(DEFAULT_RECURRENCE_FIELDS);
  }

  function advanceFromQualify(offer: CasinoOfferSummary) {
    const qw =
      offer.components.find((c) => c.componentType === "qualifying_wager") ??
      offer.components[0];
    setCarriedStep({
      rtp: qw?.rtp ?? null,
      game: qw?.game?.trim() || null,
    });
    setStepPhase("reward");
  }

  async function createCampaign() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const expiresAt = expiresAtFromParts(expiresDate, expiresTime);
      const expiryOffsetDays = (() => {
        if (expiresAt == null || !repeatsEnabled) return undefined;
        const anchor = localYmd(new Date());
        const expiresYmd = localYmd(new Date(expiresAt));
        const diffDays = Math.round(
          (parseYmd(expiresYmd).getTime() - parseYmd(anchor).getTime()) / 86_400_000
        );
        return diffDays > 0 ? diffDays : undefined;
      })();

      const res = await api<{ offer: { id: number } }>("/api/casino", {
        method: "POST",
        json: {
          casino: casino.trim() || undefined,
          title: title.trim(),
          status: "active",
          expiresAt,
          ...(repeatsEnabled
            ? { recurrence: buildRecurrenceRule(repeatFields, { expiryOffsetDays }) }
            : {}),
        },
      });
      setCreatedOfferId(res.offer.id);
      setStepPhase(draft && draftNeedsQualifyThenReward(draft) ? "qualify" : "reward");
    } catch {
      // Validation rejections leave the dialog open for correction.
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    setOpen(false);
    resetForm();
    window.dispatchEvent(new Event(CASINO_CHANGED_EVENT));
  }

  const twoStep = draft != null && draftNeedsQualifyThenReward(draft);
  const onQualifyPhase = createdOfferId != null && stepPhase === "qualify" && twoStep;

  return (
    <CasinoLogContext.Provider value={{ openCasinoLog }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          {createdOfferId == null ? (
            <>
              <DialogHeader>
                <DialogTitle>Log a casino offer</DialogTitle>
                <DialogDescription>
                  Name the campaign, then add its steps - a qualifying wager first when
                  the promo is wager-to-get, then the bonus, free spins, golden chips or
                  cashback.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-start">
                <CasinoPasteDialog
                  onApply={(d) => {
                    if (d.casino) setCasino(d.casino);
                    if (d.title) setTitle(d.title);
                    setDraft(d);
                  }}
                />
              </div>
              <div className="flex flex-col gap-3">
                <VenueSelect
                  value={casino}
                  onChange={setCasino}
                  label="Casino"
                  placeholder="Select bookie"
                  kinds={["bookie"]}
                  className="w-full"
                />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="casino-title" className="text-xs text-muted-foreground">
                    Offer
                  </Label>
                  <Input
                    id="casino-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Wager £10 get £1 bonus"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="casino-expires-date" className="text-xs text-muted-foreground">
                      Expires
                    </Label>
                    <DatePicker
                      id="casino-expires-date"
                      value={expiresDate}
                      onChange={setExpiresDate}
                      placeholder="Pick a date"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="casino-expires-time" className="text-xs text-muted-foreground">
                      Time
                    </Label>
                    <EventTimeInput
                      id="casino-expires-time"
                      value={expiresTime}
                      onChange={setExpiresTime}
                      placeholder="Pick a time"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={repeatsEnabled}
                    onChange={(e) => setRepeatsEnabled(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-foreground">Repeats</span>
                    <span className="mt-0.5 block text-muted-foreground">
                      Creates a new campaign each occurrence. Each gets its own ID so steps
                      and completion stay separate.
                    </span>
                  </span>
                </label>
                {repeatsEnabled ? (
                  <RecurrenceRuleFields
                    value={repeatFields}
                    onChange={setRepeatFields}
                    helpText="Each occurrence uses the same steps you add next, with EV derived fresh."
                  />
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void createCampaign()} disabled={saving || !title.trim()}>
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {onQualifyPhase
                    ? "Step 1 · Qualifying wager"
                    : twoStep
                      ? "Step 2 · Reward"
                      : "Add the first step"}
                </DialogTitle>
                <DialogDescription>
                  {onQualifyPhase
                    ? `Stake required to unlock ${title.trim() || "this offer"}. Next you will add the bonus or spins.`
                    : twoStep
                      ? `Reward for ${title.trim() || "this campaign"} after the qualifying wager.`
                      : `${title.trim() || "This campaign"} needs at least one step to show an EV.`}
                </DialogDescription>
              </DialogHeader>
              {onQualifyPhase ? (
                <CasinoComponentForm
                  key="qualify"
                  casinoOfferId={createdOfferId}
                  initialComponentType="qualifying_wager"
                  sourceText={draft?.sourceText}
                  initialValues={{
                    amount: draft?.qualifyStake,
                    rtp: draft?.rtp,
                  }}
                  submitLabel="Next step"
                  onSaved={advanceFromQualify}
                  onCancel={finish}
                />
              ) : (
                <CasinoComponentForm
                  key="reward"
                  casinoOfferId={createdOfferId}
                  initialComponentType={rewardStepType(draft)}
                  sourceText={draft?.sourceText}
                  initialGameName={carriedStep?.game}
                  initialValues={
                    draft || carriedStep
                      ? {
                          amount: draft?.bonusAmount,
                          // Only prefill wagering / contribution when OCR found them.
                          wageringMultiplier: draft?.wageringMultiplier,
                          contributionPct: draft?.contributionPct,
                          // Prefer RTP chosen on the qualifying step, else OCR.
                          rtp: carriedStep?.rtp ?? draft?.rtp,
                          spins: draft?.spins,
                          spinValue: draft?.spinValue,
                          chipCount: draft?.chipCount,
                          chipValue: draft?.chipValue,
                          cashbackPct: draft?.cashbackPct,
                        }
                      : undefined
                  }
                  submitLabel={twoStep ? "Finish" : "Add step"}
                  onSaved={finish}
                  onCancel={finish}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </CasinoLogContext.Provider>
  );
}
