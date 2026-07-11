"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAddBet } from "@/components/add-bet-provider";
import { OfferCampaignCard } from "@/components/offers/offer-campaign-card";
import { useAppState } from "@/hooks/use-app-state";
import { deriveTrackBetAction } from "@/lib/offers/offer-track-bet";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import type { OfferSummary } from "@/lib/services/offers.types";
import { ExternalLink } from "lucide-react";

export function OfferViewDialog({
  open,
  onOpenChange,
  offer,
  nextActionLabel,
  nextActionDetail,
  onRefresh,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: OfferSummary | null;
  nextActionLabel?: string | null;
  nextActionDetail?: string | null;
  onRefresh: () => void;
  onEdit: (offer: OfferSummary) => void;
}) {
  const { openAddBet } = useAddBet();
  const { state } = useAppState(5000);

  if (!offer) return null;

  const trackBet = deriveTrackBetAction(offer, state?.settings);

  function handleTrackBet() {
    if (!trackBet.prefill) return;
    onOpenChange(false);
    openAddBet(trackBet.prefill);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onFocusOutside={preventDialogDismissOnPortaledContent}
        onPointerDownOutside={preventDialogDismissOnPortaledContent}
        onInteractOutside={preventDialogDismissOnPortaledContent}
      >
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-7">
          <DialogTitle className="text-[25px] font-extrabold tracking-tight">
            Campaign details
          </DialogTitle>
          <DialogDescription>
            {nextActionDetail?.trim() ||
              (nextActionLabel
                ? `${nextActionLabel} — ${offer.title}`
                : offer.title)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <OfferCampaignCard
            offer={offer}
            nextActionLabel={nextActionLabel}
            nextActionDetail={nextActionDetail}
            onRefresh={onRefresh}
            onEdit={onEdit}
            defaultDetailsOpen
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 border-t px-6 py-5">
          <Button variant="outline" size="lg" asChild>
            <Link
              href={`/offers?highlight=${offer.id}`}
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink className="size-4" />
              Open in Campaigns
            </Link>
          </Button>
          <span title={trackBet.reason ?? undefined} className="inline-flex">
            <Button
              size="lg"
              onClick={handleTrackBet}
              disabled={!trackBet.enabled || !trackBet.prefill}
            >
              {trackBet.label}
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
