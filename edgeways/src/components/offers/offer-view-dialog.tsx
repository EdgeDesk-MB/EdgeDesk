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
import { SplitButton } from "@/components/ui/split-button";
import { useAddBet } from "@/components/add-bet-provider";
import { useAccaRun } from "@/components/acca-run-provider";
import { useBetBuilderRun } from "@/components/bet-builder-run-provider";
import { useScopePlaceChooser } from "@/components/scope-place-chooser-provider";
import { OfferCampaignCard } from "@/components/offers/offer-campaign-card";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  completedKindFromBetType,
  notifyOfferStepDone,
  quietOfferPromptToasts,
} from "@/lib/alerts/quiet-offer-toasts";
import {
  deriveTrackBetAction,
  resolveTrackBetDestination,
} from "@/lib/offers/offer-track-bet";
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
  const { openAccaRun } = useAccaRun();
  const { openBetBuilderRun } = useBetBuilderRun();
  const { openScopeChooser } = useScopePlaceChooser();
  const { state } = useAppState(5000);
  const [marking, setMarking] = useState(false);

  if (!offer) return null;

  const trackBet = deriveTrackBetAction(offer, state?.settings);
  const isConvertAction = trackBet.prefill?.betType === "free_snr";
  const isPlaybookMarkDone = trackBet.destination.kind === "playbook_mark_done";
  const canQuickMark =
    trackBet.enabled && trackBet.prefill != null && !isPlaybookMarkDone;

  function handleTrackBet() {
    if (isPlaybookMarkDone) {
      void handlePlaybookMarkDone();
      return;
    }
    resolveTrackBetDestination(trackBet, {
      openAddBet,
      openAccaRun,
      openBetBuilderRun,
      openScopeChooser,
      beforeOpen: () => onOpenChange(false),
    });
  }

  async function handlePlaybookMarkDone() {
    if (trackBet.destination.kind !== "playbook_mark_done") return;
    setMarking(true);
    try {
      await api(`/api/offers/${offer!.id}`, {
        method: "PATCH",
        json: { playbookStepDone: trackBet.destination.stepId },
      });
      toast.success("Step marked done", { description: trackBet.label });
      onRefresh();
    } catch (err) {
      toast.error("Could not update step", { description: formatApiError(err) });
    } finally {
      setMarking(false);
    }
  }

  // Quick-logs a minimal bet (no odds/selection yet) so the campaign progresses
  // when the qualifying leg was placed outside Acca Desk / Add bet / chooser.
  async function handleMarkPlaced() {
    const p = trackBet.prefill;
    if (!p) return;
    setMarking(true);
    try {
      const betType = p.betType ?? "qualifying";
      const offerId = p.offerId ?? offer!.id;
      const { bet } = await api<{ bet: { id: number } }>("/api/bets", {
        method: "POST",
        json: {
          label: p.label || p.labelSuggestion || offer!.title,
          market: p.market,
          betType,
          bookmaker: p.bookmaker,
          backStake: p.backStake ?? 0,
          backOdds: p.backOdds ?? 0,
          triggerText: p.triggerText,
          offerId,
          quickLogged: true,
        },
      });
      quietOfferPromptToasts(offerId, {
        completedKind: completedKindFromBetType(betType),
      });
      notifyOfferStepDone({
        offerId,
        betId: bet.id,
        betType,
        bookmaker: p.bookmaker,
        offerTitle: offer!.title,
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
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle>Campaign details</DialogTitle>
          <DialogDescription>
            {nextActionLabel ? `Next: ${nextActionLabel}` : "Review this campaign."}
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

        <div className="flex w-full shrink-0 items-center gap-4 border-t px-6 py-5">
          <div className="min-w-0 flex-1">
            <OfferEffortLine offerId={offer.id} />
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
            <Button variant="outline" size="lg" asChild>
              <Link
                href={`/offers?highlight=${offer.id}`}
                onClick={() => onOpenChange(false)}
              >
                <ExternalLink className="size-4" />
                Open in Campaigns
              </Link>
            </Button>
            {isPlaybookMarkDone ? (
              <Button
                size="lg"
                onClick={() => void handlePlaybookMarkDone()}
                disabled={!trackBet.enabled || marking}
              >
                {marking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {trackBet.label}
              </Button>
            ) : (
              <SplitButton title={trackBet.reason ?? undefined}>
                <SplitButton.Leading
                  size="lg"
                  variant={isConvertAction ? "edge" : "default"}
                  onClick={handleTrackBet}
                  disabled={!trackBet.enabled}
                >
                  {trackBet.label}
                </SplitButton.Leading>
                <SplitButton.Trailing
                  size="icon-lg"
                  variant={isConvertAction ? "edge" : "default"}
                  onClick={() => void handleMarkPlaced()}
                  disabled={!canQuickMark || marking}
                  aria-label={
                    isConvertAction
                      ? "Mark free bet conversion as placed"
                      : "Mark qualifying bet as placed"
                  }
                  title={
                    isConvertAction
                      ? "Already converted outside Edgeways? Tick to quick-log the free bet leg."
                      : "Already placed outside Edgeways? Tick to quick-log the qualifying bet."
                  }
                >
                  {marking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </SplitButton.Trailing>
              </SplitButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
