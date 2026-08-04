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
  DialogTrigger,
} from "@/components/ui/dialog";
import { CasinoComponentForm } from "@/components/casino/casino-component-form";
import type { CasinoOfferComponentRow } from "@/lib/db/schema";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export function CasinoComponentDialog({
  casinoOfferId,
  existing,
  onSaved,
}: {
  casinoOfferId: number;
  /** Present = edit mode (small pencil trigger); absent = add mode ("+ Add step") */
  existing?: CasinoOfferComponentRow;
  onSaved: (offer: CasinoOfferSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Edit step"
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-3.5" aria-hidden /> Add step
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit step" : "Add a step"}</DialogTitle>
          <DialogDescription>
            A campaign can carry any combination - a qualifying wager, plus one or more rewards.
          </DialogDescription>
        </DialogHeader>
        <CasinoComponentForm
          casinoOfferId={casinoOfferId}
          existing={existing}
          onSaved={(offer) => {
            setOpen(false);
            onSaved(offer);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
