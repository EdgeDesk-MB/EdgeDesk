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
 * Saving fires CASINO_CHANGED_EVENT so the Casino page and calendar refresh
 * if mounted. Calendar tiles open the campaign in CasinoViewDialog via
 * `viewCasino`, matching the offers calendar → OfferViewDialog path.
 */

import { createContext, useCallback, useContext, useState } from "react";
import { useDevStickyOpen } from "@/lib/dev/use-dev-sticky-open";
import { computeCasinoFormReadiness } from "@/lib/offers/offer-form-readiness";
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
import { CasinoOfferEditDialog } from "@/components/casino/casino-offer-edit-dialog";
import { CasinoViewDialog } from "@/components/casino/casino-view-dialog";
import { CASINO_CHANGED_EVENT } from "@/components/casino/casino-ui";
import { InlinePasteStrip } from "@/components/offers/inline-paste-strip";
import {
  PasteFieldLabel,
  pasteDescribedBy,
  pasteFieldClass,
} from "@/components/offers/paste-field-chrome";
import {
  DEFAULT_RECURRENCE_FIELDS,
  RecurrenceRuleFields,
  buildRecurrenceRule,
  type RecurrenceRuleFieldsValue,
} from "@/components/offers/recurrence-rule-fields";
import { OfferUrlField } from "@/components/offers/offer-url-field";
import { VenueSelect } from "@/components/venue-select";
import { api } from "@/hooks/use-app-state";
import type { CasinoComponentType } from "@/lib/calc/casino-reward-ev";
import { parseEligibleGamesJson } from "@/lib/casino/eligible-games";
import {
  countPasteFields,
  markCasinoFieldUser,
  mergeCasinoPasteDraft,
  type CasinoPasteProvenance,
} from "@/lib/offers/merge-paste-draft";
import { fromDatetimeLocalValue } from "@/lib/offers/offer-terms";
import { localYmd, parseYmd } from "@/lib/offers/offer-recurrence-shared";
import { isInvalidOfferUrlInput, normalizeOfferUrl } from "@/lib/offers/offer-url";
import {
  draftNeedsQualifyThenReward,
  parseCasinoOfferText,
  type ParsedCasinoOfferDraft,
} from "@/lib/offers/parse-casino-offer-text";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";
import { cn } from "@/lib/utils";

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
  eligibleGames: string[];
};

type CasinoLogContextValue = {
  openCasinoLog: () => void;
  viewCasino: (offer: CasinoOfferSummary) => void;
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
  const [open, setOpen] = useDevStickyOpen("casino-log");
  const [casino, setCasino] = useState("");
  const [title, setTitle] = useState("");
  const [offerUrl, setOfferUrl] = useState("");
  const [expiresDate, setExpiresDate] = useState(defaultExpiresDate);
  const [expiresTime, setExpiresTime] = useState(DEFAULT_EXPIRES_TIME);
  const [saving, setSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [createdOfferId, setCreatedOfferId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ParsedCasinoOfferDraft | null>(null);
  const [stepPhase, setStepPhase] = useState<StepPhase>("reward");
  const [carriedStep, setCarriedStep] = useState<CarriedStepDefaults | null>(null);
  const [repeatsEnabled, setRepeatsEnabled] = useState(false);
  const [repeatFields, setRepeatFields] =
    useState<RecurrenceRuleFieldsValue>(DEFAULT_RECURRENCE_FIELDS);
  const [pasteText, setPasteText] = useState("");
  const [pasteProvenance, setPasteProvenance] = useState<CasinoPasteProvenance>({});
  const [pasteConfidence, setPasteConfidence] = useState<
    "high" | "medium" | "low" | null
  >(null);
  const [viewOffer, setViewOffer] = useState<CasinoOfferSummary | null>(null);
  const [editOffer, setEditOffer] = useState<CasinoOfferSummary | null>(null);

  const openCasinoLog = useCallback(() => {
    setExpiresDate(defaultExpiresDate());
    setExpiresTime(DEFAULT_EXPIRES_TIME);
    setOpen(true);
  }, []);

  const viewCasino = useCallback((offer: CasinoOfferSummary) => {
    setEditOffer(null);
    setViewOffer(offer);
  }, []);

  function handleViewEdit(offer: CasinoOfferSummary) {
    setViewOffer(null);
    setEditOffer(offer);
  }

  function announceCasinoChanged() {
    window.dispatchEvent(new Event(CASINO_CHANGED_EVENT));
  }

  function resetForm() {
    setCasino("");
    setTitle("");
    setOfferUrl("");
    setExpiresDate(defaultExpiresDate());
    setExpiresTime(DEFAULT_EXPIRES_TIME);
    setCreatedOfferId(null);
    setDraft(null);
    setStepPhase("reward");
    setCarriedStep(null);
    setRepeatsEnabled(false);
    setRepeatFields(DEFAULT_RECURRENCE_FIELDS);
    setUrlError(null);
    setPasteText("");
    setPasteProvenance({});
    setPasteConfidence(null);
  }

  function handlePasteTextChange(next: string) {
    setPasteText(next);
    if (!next.trim()) {
      setPasteConfidence(null);
      return;
    }
    const parsed = parseCasinoOfferText(next);
    const { form, provenance } = mergeCasinoPasteDraft(
      { casino, title, draft },
      parsed,
      pasteProvenance
    );
    setCasino(form.casino);
    setTitle(form.title);
    setDraft(form.draft);
    setPasteProvenance(provenance);
    setPasteConfidence(parsed.confidence);
  }

  const formReadiness = computeCasinoFormReadiness({
    casino,
    title,
    hasDraft: draft != null,
  });

  function advanceFromQualify(offer: CasinoOfferSummary) {
    const qw =
      offer.components.find((c) => c.componentType === "qualifying_wager") ??
      offer.components[0];
    setCarriedStep({
      rtp: qw?.rtp ?? null,
      game: qw?.game?.trim() || null,
      eligibleGames: parseEligibleGamesJson(qw?.eligibleGamesJson),
    });
    setStepPhase("reward");
  }

  async function createCampaign() {
    if (!title.trim()) return;
    if (isInvalidOfferUrlInput(offerUrl)) {
      setUrlError("Enter a valid http(s) link, or clear the field.");
      return;
    }
    setUrlError(null);
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
          offerUrl: normalizeOfferUrl(offerUrl),
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
    <CasinoLogContext.Provider value={{ openCasinoLog, viewCasino }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="flex max-h-[92vh] max-w-md flex-col overflow-hidden">
          {createdOfferId == null ? (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle>Log a casino offer</DialogTitle>
                <DialogDescription>
                  Name the campaign, then add its steps.
                </DialogDescription>
              </DialogHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                <InlinePasteStrip
                  text={pasteText}
                  onTextChange={handlePasteTextChange}
                  filledCount={countPasteFields(pasteProvenance)}
                  confidence={pasteConfidence}
                  readyCompleted={formReadiness.completed}
                  readyTotal={formReadiness.total}
                  buttonLabel="Paste promo"
                  textLabel="Promo text"
                  placeholder={`Sky Vegas
Stake £10 get a £20 casino bonus
35x wagering · Selected slots only · RTP 96.5%`}
                />
                <div className="flex flex-col gap-1.5">
                  <PasteFieldLabel provenance={pasteProvenance.casino} describedById="casino-venue-paste">
                    Casino
                  </PasteFieldLabel>
                  <VenueSelect
                    value={casino}
                    onChange={(v) => {
                      setCasino(v);
                      setPasteProvenance((p) => markCasinoFieldUser(p, "casino"));
                    }}
                    label=""
                    placeholder="Select bookie"
                    kinds={["bookie"]}
                    className={cn("w-full", pasteFieldClass(pasteProvenance.casino))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <PasteFieldLabel
                    htmlFor="casino-title"
                    provenance={pasteProvenance.title}
                    required
                  >
                    Offer
                  </PasteFieldLabel>
                  <Input
                    id="casino-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setPasteProvenance((p) => markCasinoFieldUser(p, "title"));
                    }}
                    placeholder="e.g. Wager £10 get £1 bonus"
                    aria-describedby={pasteDescribedBy(pasteProvenance.title, "casino-title")}
                    className={pasteFieldClass(pasteProvenance.title, {
                      requiredEmpty: Boolean(pasteText.trim()) && !title.trim(),
                    })}
                  />
                </div>
                <OfferUrlField
                  id="casino-url"
                  value={offerUrl}
                  onChange={(next) => {
                    setOfferUrl(next);
                    if (urlError) setUrlError(null);
                  }}
                  labelClassName="text-xs"
                  gapClassName="gap-1.5"
                  aria-invalid={urlError ? true : undefined}
                  error={urlError}
                />
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
                      shortcuts="ending"
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
                      shortcuts="ending"
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
              <div className="flex shrink-0 justify-end gap-2 border-t pt-3">
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
                    ? `Stake required to unlock ${title.trim() || "this offer"}.`
                    : twoStep
                      ? `Reward after the qualifying wager.`
                      : `Add a step so this campaign can show an EV.`}
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
                  initialComponentType={
                    twoStep ? rewardStepType(draft) : "qualifying_wager"
                  }
                  sourceText={draft?.sourceText}
                  initialGameName={carriedStep?.game}
                  initialGameNames={carriedStep?.eligibleGames}
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
      <CasinoViewDialog
        open={viewOffer != null}
        offer={viewOffer}
        onOpenChange={(next) => {
          if (!next) setViewOffer(null);
        }}
        onChanged={(updated) => {
          setViewOffer(updated);
          announceCasinoChanged();
        }}
        onRemoved={() => {
          setViewOffer(null);
          announceCasinoChanged();
        }}
        onEdit={handleViewEdit}
      />
      {editOffer ? (
        <CasinoOfferEditDialog
          offer={editOffer}
          showTrigger={false}
          open
          mobile="center"
          onOpenChange={(next) => {
            if (!next) setEditOffer(null);
          }}
          onSaved={(updated) => {
            setEditOffer(null);
            announceCasinoChanged();
            setViewOffer(updated);
          }}
        />
      ) : null}
    </CasinoLogContext.Provider>
  );
}
