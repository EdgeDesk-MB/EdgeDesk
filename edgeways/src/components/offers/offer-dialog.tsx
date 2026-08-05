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
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-7">
          <DialogTitle className="text-[25px] font-extrabold tracking-tight">
            {editing ? "Edit offer" : "New offer"}
          </DialogTitle>
          <DialogDescription>
            {editing ? "Update details - bets stay linked." : "Paste from MBB or fill."}
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
