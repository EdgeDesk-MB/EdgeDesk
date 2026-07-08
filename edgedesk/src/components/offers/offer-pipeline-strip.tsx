import { cn } from "@/lib/utils";
import {
  deriveOfferPipelineStage,
  OFFER_PIPELINE_STAGES,
  pipelineStageIndex,
  type OfferPipelineStage,
} from "@/lib/offers/pipeline";
import type { OfferSummary } from "@/lib/services/offers";

export function OfferPipelineStrip({
  offer,
  className,
}: {
  offer: OfferSummary;
  className?: string;
}) {
  const stage = deriveOfferPipelineStage(offer);
  if (stage === "expired") {
    return (
      <p className={cn("text-[11px] font-medium text-muted-foreground", className)}>
        Expired
      </p>
    );
  }

  const activeIdx = pipelineStageIndex(stage);

  return (
    <ol
      className={cn("flex flex-wrap items-center gap-1", className)}
      aria-label={`Offer stage: ${OFFER_PIPELINE_STAGES[activeIdx]?.label ?? stage}`}
    >
      {OFFER_PIPELINE_STAGES.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <li key={step.id} className="flex items-center gap-1">
            {i > 0 ? (
              <span
                className={cn(
                  "mx-0.5 h-px w-2 sm:w-3",
                  done || current ? "bg-primary/50" : "bg-border"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                current && "bg-primary text-primary-foreground",
                done && !current && "bg-primary/15 text-primary",
                !done && !current && "bg-muted text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function offerPipelineStageLabel(stage: OfferPipelineStage): string {
  if (stage === "expired") return "Expired";
  return OFFER_PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
}
