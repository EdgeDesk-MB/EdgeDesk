"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OfferEffortLine } from "@/components/offers/offer-effort-line";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAddBet } from "@/components/add-bet-provider";
import { OfferCampaignCard } from "@/components/offers/offer-campaign-card";
import { api, useAppState } from "@/hooks/use-app-state";
import { deriveTrackBetAction } from "@/lib/offers/offer-track-bet";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import { formatApiError } from "@/lib/api-errors";
import type { OfferSummary } from "@/lib/services/offers.types";
import { Check, ExternalLink, Loader2 } from "lucide-react";

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
  const [marking, setMarking] = useState(false);

  if (!offer) return null;

  const trackBet = deriveTrackBetAction(offer, state?.settings);

  function handleTrackBet() {
    if (!trackBet.prefill) return;
    onOpenChange(false);
    openAddBet(trackBet.prefill);
  }

  // Not every campaign gets auto-linked to a bet - this quick-logs a minimal
  // bet from the same prefill data (no odds/selection yet) so the campaign
  // still progresses. Mirrors the mobile quick-log flow: capture now, tidy
  // details in the Tracker later.
  async function handleMarkPlaced() {
    if (!trackBet.prefill) return;
    const p = trackBet.prefill;
    setMarking(true);
    try {
      await api("/api/bets", {
        method: "POST",
        json: {
          label: p.label || p.labelSuggestion || offer!.title,
          market: p.market,
          betType: p.betType ?? "qualifying",
          bookmaker: p.bookmaker,
          backStake: p.backStake ?? 0,
          backOdds: p.backOdds ?? 0,
          triggerText: p.triggerText,
          offerId: p.offerId,
          quickLogged: true,
        },
      });
      toast.success("Qualifying bet marked as placed", {
        description: "Quick-logged - add odds and details from the Tracker when you can.",
      });
      onRefresh();
    } catch (err) {
      toast.error("Could not mark bet as placed", { description: formatApiError(err) });
    } finally {
      setMarking(false);
    }
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
          <span className="mr-auto">
            <OfferEffortLine offerId={offer.id} />
          </span>
          <Button variant="outline" size="lg" asChild>
            <Link
              href={`/offers?highlight=${offer.id}`}
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink className="size-4" />
              Open in Campaigns
            </Link>
          </Button>
          <span
            title={trackBet.reason ?? undefined}
            className="inline-flex overflow-hidden rounded-lg"
          >
            <Button
              size="lg"
              className="rounded-r-none"
              onClick={handleTrackBet}
              disabled={!trackBet.enabled || !trackBet.prefill}
            >
              {trackBet.label}
            </Button>
            <Button
              size="icon-lg"
              className="rounded-l-none border-l border-l-primary-foreground/20"
              onClick={() => void handleMarkPlaced()}
              disabled={!trackBet.enabled || !trackBet.prefill || marking}
              aria-label="Mark qualifying bet as placed"
              title="Not linked automatically? Tick to mark the qualifying bet as placed."
            >
              {marking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
            </Button>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
