"use client";

/** Dialog chrome around CasinoComponentForm (K1) - add or edit one component on a campaign card. */

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CasinoComponentForm } from "@/components/casino/casino-component-form";
import { inheritCasinoStepDefaults } from "@/lib/casino/inherit-step-defaults";
import type { CasinoOfferComponentRow } from "@/lib/db/schema";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export function CasinoComponentDialog({
  casinoOfferId,
  existing,
  siblings,
  onSaved,
  mobile = "sheet",
}: {
  casinoOfferId: number;
  /** Present = edit mode (small pencil trigger); absent = add mode ("+ Add step") */
  existing?: CasinoOfferComponentRow;
  /** Other steps on this campaign - used to prefill a new step */
  siblings?: CasinoOfferComponentRow[];
  onSaved: (offer: CasinoOfferSummary) => void;
  mobile?: "sheet" | "center";
}) {
  const [open, setOpen] = useState(false);
  const inherited =
    !existing && siblings && siblings.length > 0 ? inheritCasinoStepDefaults(siblings) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Controlled open (not DialogTrigger) so outline Add step stays on the Press path. */}
      {existing ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label="Edit step"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5" aria-hidden /> Add step
        </Button>
      )}
      <DialogContent className="max-w-md" mobile={mobile}>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit step" : "Add a step"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Edit this cost or reward. Campaign EV is the sum of every step."
              : "Add another qualifying wager to start the next stake tier, or a reward that pairs with the latest one."}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CasinoComponentForm
            key={existing ? `edit-${existing.id}` : `add-${siblings?.length ?? 0}`}
            casinoOfferId={casinoOfferId}
            existing={existing}
            initialComponentType={existing ? undefined : "qualifying_wager"}
            initialGameNames={inherited?.eligibleGameNames}
            initialValues={
              inherited
                ? {
                    amount: inherited.amount,
                    wageringMultiplier: inherited.wageringMultiplier,
                    rtp: inherited.rtp,
                    contributionPct: inherited.contributionPct,
                    spins: inherited.spins,
                    spinValue: inherited.spinValue,
                    chipCount: inherited.chipCount,
                    chipValue: inherited.chipValue,
                    cashbackPct: inherited.cashbackPct,
                  }
                : undefined
            }
            onSaved={(offer) => {
              setOpen(false);
              onSaved(offer);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
