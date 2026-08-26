"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import {
  deriveOfferPipelineStage,
  earliestOpenBetEventAt,
  formatOfferPipelineStageLabel,
  isTerminalPipelineStage,
  OFFER_PIPELINE_PROGRESS_STAGES,
  OFFER_PIPELINE_STAGES,
  pipelineProgressIndex,
  type OfferPipelineStage,
} from "@/lib/offers/pipeline";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { OfferDeskProgress } from "@/lib/offers/offer-desk-progress";
import { Check } from "lucide-react";

/** Progress fill — free-bet stages use `--edge` (same plate as FB badge / Convert). */
function stageProgressClass(stage: OfferPipelineStage): string {
  switch (stage) {
    case "qualifying":
      return "bg-sky-500";
    case "awaiting":
      return "bg-amber-500";
    case "awarded":
    case "converting":
      return "bg-edge";
    case "completed":
      return "bg-emerald-500/70";
    case "settled":
      return "bg-emerald-500";
    case "expired":
      return "bg-muted-foreground/40";
    default:
      return "bg-muted-foreground/45";
  }
}

function stageLabelClass(stage: OfferPipelineStage): string {
  switch (stage) {
    case "awarded":
    case "converting":
      return "text-edge";
    case "completed":
    case "settled":
      return "text-emerald-700 dark:text-emerald-400";
    case "awaiting":
      return "text-amber-800 dark:text-amber-300";
    case "qualifying":
      return "text-sky-800 dark:text-sky-300";
    default:
      return "text-foreground";
  }
}

function TerminalPipelineStatus({
  stage,
  className,
}: {
  stage: "completed" | "settled";
  className?: string;
}) {
  const label = stage === "settled" ? "Settled" : "Completed";
  return (
    <div className={className} aria-label={`Offer ${label.toLowerCase()}`}>
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold",
          stageLabelClass(stage)
        )}
      >
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full ring-1",
            stage === "settled"
              ? "bg-emerald-500/15 ring-emerald-500/30"
              : "bg-emerald-500/10 ring-emerald-500/25"
          )}
        >
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
        {label}
      </p>
    </div>
  );
}

/**
 * Campaign progress — hidden until the first step.
 * Completed = campaign closed; Settled = all bet results in (final).
 */
function DeskProgressStrip({
  progress,
  className,
}: {
  progress: OfferDeskProgress;
  className?: string;
}) {
  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const stage: OfferPipelineStage = progress.needsAction ? "qualifying" : "awaiting";
  const caption = [
    progress.progressCaption,
    progress.nextCaption ? `next ${progress.nextCaption}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const announced = `${progress.stageLabel}: ${caption}`;
  return (
    <div className={cn("min-w-0", className)} aria-label={announced}>
      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <p className={cn("min-w-0 text-pretty break-words text-xs font-semibold", stageLabelClass(stage))}>
          {progress.stageLabel}
        </p>
        <p className="min-w-0 text-pretty break-words text-xs tabular-nums text-muted-foreground sm:text-right">
          {caption}
        </p>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-input/40"
        role="progressbar"
        aria-label={announced}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={caption}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            stageProgressClass(stage)
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function OfferPipelineStrip({
  offer,
  className,
}: {
  offer: OfferSummary;
  className?: string;
}) {
  const { state } = useAppState(0);
  const awaitingEventAt = useMemo(() => {
    if (offer.awaitingEventAt != null) return offer.awaitingEventAt;
    if (!state) return null;
    const eventsById = new Map(state.events.map((e) => [e.id, e]));
    return earliestOpenBetEventAt(
      state.bets.filter((b) => b.offerId === offer.id),
      eventsById
    );
  }, [offer.awaitingEventAt, offer.id, state]);
  if (offer.deskProgress) {
    return <DeskProgressStrip progress={offer.deskProgress} className={className} />;
  }
  const stage = deriveOfferPipelineStage(offer);

  if (stage === "planned") return null;

  if (stage === "expired") {
    return (
      <div className={className}>
        <p className="text-xs font-medium text-muted-foreground">Expired</p>
      </div>
    );
  }

  if (isTerminalPipelineStage(stage)) {
    return <TerminalPipelineStatus stage={stage} className={className} />;
  }

  const activeIdx = pipelineProgressIndex(stage);
  const total = OFFER_PIPELINE_PROGRESS_STAGES.length;
  const pct = Math.round(((activeIdx + 1) / total) * 100);
  const currentLabel = formatOfferPipelineStageLabel(
    { ...offer, awaitingEventAt },
    stage
  );
  const next =
    activeIdx < total - 1 ? OFFER_PIPELINE_PROGRESS_STAGES[activeIdx + 1] : null;

  return (
    <div className={className} aria-label={`Offer stage: ${currentLabel}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("text-xs font-semibold", stageLabelClass(stage))}>
          {currentLabel}
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {activeIdx + 1}/{total}
          {next ? ` · next ${next.label}` : ""}
        </p>
      </div>

      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted dark:bg-input/40"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            stageProgressClass(stage)
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function offerPipelineStageLabel(stage: OfferPipelineStage): string {
  if (stage === "expired") return "Expired";
  return OFFER_PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
}
