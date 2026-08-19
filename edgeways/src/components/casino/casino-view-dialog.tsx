"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CasinoCampaignCard } from "@/components/casino/casino-campaign-card";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

export function CasinoViewDialog({
  open,
  onOpenChange,
  offer,
  onChanged,
  onRemoved,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: CasinoOfferSummary | null;
  onChanged: (offer: CasinoOfferSummary) => void;
  onRemoved: () => void;
  onEdit: (offer: CasinoOfferSummary) => void;
}) {
  if (!offer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onFocusOutside={preventDialogDismissOnPortaledContent}
        onPointerDownOutside={preventDialogDismissOnPortaledContent}
        onInteractOutside={preventDialogDismissOnPortaledContent}
      >
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle>Campaign details</DialogTitle>
          <DialogDescription>Review this campaign.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <CasinoCampaignCard
            offer={offer}
            onChanged={onChanged}
            onRemoved={onRemoved}
            onEdit={onEdit}
            nestedDialogMobile="center"
          />
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-3 border-t px-6 py-5">
          <Button variant="outline" size="lg" asChild>
            <Link href="/casino" onClick={() => onOpenChange(false)}>
              <ExternalLink className="size-4" />
              Open in Casino
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
