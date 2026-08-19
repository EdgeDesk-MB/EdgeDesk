"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  OfferEditorForm,
  type OfferEditorPrefill,
} from "@/components/offers/offer-editor-form";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";

export function OfferDialog({
  open,
  onOpenChange,
  prefill,
  formKey = 0,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: OfferEditorPrefill;
  formKey?: number;
  onSaved: () => void;
}) {
  const editing = prefill?.editOffer != null;
  const [blockDismiss, setBlockDismiss] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && blockDismiss) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"
        onFocusOutside={preventDialogDismissOnPortaledContent}
        onPointerDownOutside={(e) => {
          preventDialogDismissOnPortaledContent(e);
          if (blockDismiss) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          preventDialogDismissOnPortaledContent(e);
          if (blockDismiss) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (blockDismiss) e.preventDefault();
        }}
      >
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle>{editing ? "Edit offer" : "New offer"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the details. Linked bets stay put." : "Paste a promo or fill the form."}
          </DialogDescription>
        </DialogHeader>
        <OfferEditorForm
          key={`offer-form-${formKey}`}
          open={open}
          prefill={prefill}
          onBlockingOverlayChange={setBlockDismiss}
          onSaved={() => {
            onSaved();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
