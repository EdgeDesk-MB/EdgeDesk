import { cn } from "@/lib/utils";
import {
  deriveOfferPipelineStage,
  formatOfferPipelineStageLabel,
  isTerminalPipelineStage,
  OFFER_PIPELINE_PROGRESS_STAGES,
  OFFER_PIPELINE_STAGES,
  pipelineProgressIndex,
  type OfferPipelineStage,
} from "@/lib/offers/pipeline";
import type { OfferSummary } from "@/lib/services/offers.types";
import { Check } from "lucide-react";

/** Progress fill colour by current stage - free-bet stages use violet. */
function stageProgressClass(stage: OfferPipelineStage): string {
  switch (stage) {
    case "qualifying":
      return "bg-sky-500";
    case "awaiting":
      return "bg-amber-500";
    case "awarded":
      return "bg-violet-500";
    case "converting":
      return "bg-violet-600";
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
      return "text-violet-700 dark:text-violet-300";
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
          <Check className="size-2.5" strokeWidth={3} aria-hidden />
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
export function OfferPipelineStrip({
  offer,
  className,
}: {
  offer: OfferSummary;
  className?: string;
}) {
  const stage = deriveOfferPipelineStage(offer);

  if (stage === "planned") return null;

  if (stage === "expired") {
    return (
      <div className={className}>
        <p className="text-[11px] font-medium text-muted-foreground">Expired</p>
      </div>
    );
  }

  if (isTerminalPipelineStage(stage)) {
    return <TerminalPipelineStatus stage={stage} className={className} />;
  }

  const activeIdx = pipelineProgressIndex(stage);
  const total = OFFER_PIPELINE_PROGRESS_STAGES.length;
  const pct = Math.round(((activeIdx + 1) / total) * 100);
  const currentLabel = formatOfferPipelineStageLabel(offer, stage);
  const next =
    activeIdx < total - 1 ? OFFER_PIPELINE_PROGRESS_STAGES[activeIdx + 1] : null;

  return (
    <div className={className} aria-label={`Offer stage: ${currentLabel}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("text-xs font-semibold", stageLabelClass(stage))}>
          {currentLabel}
        </p>
        <p className="text-[10px] tabular-nums text-muted-foreground">
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
