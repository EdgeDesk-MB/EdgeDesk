"use client";

/**
 * Global "Log a casino offer" dialog (H2/K1) - openable from the side-nav quick
 * action on any page, mirroring the add-bet / matched-calculator providers.
 *
 * K1: a casino offer is a CAMPAIGN that can carry multiple components (a
 * qualifying wager, plus one or more rewards). This dialog is a two-step
 * flow that reads as one: step 1 creates the empty campaign (casino, title),
 * step 2 immediately opens the component form for the first reward - the
 * common single-component case (a plain Bonus offer) still feels like one
 * dialog even though it's technically two API calls.
 *
 * K3: step 1 can enable Repeats; the first component seals the series template
 * and materialises the horizon.
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
import { fromDatetimeLocalValue } from "@/lib/offers/offer-terms";
import { localYmd, parseYmd } from "@/lib/offers/offer-recurrence-shared";
import type { ParsedCasinoOfferDraft } from "@/lib/offers/parse-casino-offer-text";

type CasinoLogContextValue = {
  openCasinoLog: () => void;
};

const CasinoLogContext = createContext<CasinoLogContextValue | null>(null);

export function useCasinoLog() {
  const ctx = useContext(CasinoLogContext);
  if (!ctx) throw new Error("useCasinoLog must be used within CasinoLogProvider");
  return ctx;
}

export function CasinoLogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [casino, setCasino] = useState("");
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdOfferId, setCreatedOfferId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ParsedCasinoOfferDraft | null>(null);
  const [repeatsEnabled, setRepeatsEnabled] = useState(false);
  const [repeatFields, setRepeatFields] =
    useState<RecurrenceRuleFieldsValue>(DEFAULT_RECURRENCE_FIELDS);

  const openCasinoLog = useCallback(() => setOpen(true), []);

  function resetForm() {
    setCasino("");
    setTitle("");
    setExpires("");
    setCreatedOfferId(null);
    setDraft(null);
    setRepeatsEnabled(false);
    setRepeatFields(DEFAULT_RECURRENCE_FIELDS);
  }

  async function createCampaign() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const expiresAt = fromDatetimeLocalValue(expires);
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
                  Name the campaign, then add its first step - a qualifying wager, cash,
                  bonus, free spins, golden chips or cashback. Add more later if the offer
                  bundles several.
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
                    placeholder="e.g. Stake £10 get 50 spins"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="casino-expires" className="text-xs text-muted-foreground">
                    Expires
                  </Label>
                  <Input
                    id="casino-expires"
                    type="datetime-local"
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                  />
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
                <DialogTitle>Add the first step</DialogTitle>
                <DialogDescription>
                  {title.trim() || "This campaign"} needs at least one step to show an EV.
                </DialogDescription>
              </DialogHeader>
              <CasinoComponentForm
                casinoOfferId={createdOfferId}
                initialComponentType={draft?.likelyComponentType ?? "bonus"}
                sourceText={draft?.sourceText}
                initialValues={
                  draft
                    ? {
                        amount: draft.bonusAmount,
                        wageringMultiplier: draft.wageringMultiplier,
                        rtp: draft.rtp,
                        contributionPct: draft.contributionPct,
                        spins: draft.spins,
                        spinValue: draft.spinValue,
                        chipCount: draft.chipCount,
                        chipValue: draft.chipValue,
                        cashbackPct: draft.cashbackPct,
                      }
                    : undefined
                }
                onSaved={finish}
                onCancel={finish}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </CasinoLogContext.Provider>
  );
}
