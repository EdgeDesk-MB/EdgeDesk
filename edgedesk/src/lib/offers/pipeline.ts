import type { OfferSummary } from "@/lib/services/offers.types";

export type OfferPipelineStage =
  | "planned"
  | "qualifying"
  | "awaiting"
  | "awarded"
  | "converting"
  | "completed"
  | "settled"
  | "expired";

export const OFFER_PIPELINE_STAGES: {
  id: OfferPipelineStage;
  label: string;
}[] = [
  { id: "planned", label: "Planned" },
  { id: "qualifying", label: "Qualifying" },
  { id: "awaiting", label: "Awaiting" },
  { id: "awarded", label: "Awarded" },
  { id: "converting", label: "Converting" },
  { id: "completed", label: "Completed" },
  { id: "settled", label: "Settled" },
];

/** Progress UI steps — planned is implicit (offer exists) and omitted from the bar. */
export const OFFER_PIPELINE_PROGRESS_STAGES = OFFER_PIPELINE_STAGES.filter(
  (s) => s.id !== "planned"
);

export function pipelineProgressIndex(stage: OfferPipelineStage): number {
  if (stage === "planned" || stage === "expired") return -1;
  const idx = OFFER_PIPELINE_PROGRESS_STAGES.findIndex((s) => s.id === stage);
  return idx >= 0 ? idx : 0;
}

/** Terminal stages — no progress bar; show status chip instead. */
export function isTerminalPipelineStage(stage: OfferPipelineStage): boolean {
  return stage === "completed" || stage === "settled";
}

/** Map offer + profit breakdown to a campaign pipeline stage. */
export function deriveOfferPipelineStage(offer: OfferSummary): OfferPipelineStage {
  if (offer.status === "expired") return "expired";

  const { profit } = offer;

  // Financial closure — free-bet (or linked) legs have results and P&L is final.
  if (profit.freeBetStage === "settled") return "settled";

  // Campaign marked complete — workflow done; may still await a future result.
  if (offer.status === "completed") return "completed";

  if (profit.freeBetStage === "in_use") return "converting";
  if (profit.freeBetStage === "awarded") return "awarded";
  if (profit.freeBetStage === "awaiting_result") return "awaiting";
  if (profit.qualifyingOpenCount > 0) return "qualifying";
  if (profit.qualifyingSettledCount > 0 && profit.freeBetStage === "not_awarded") {
    return offer.status === "completed" ? "completed" : "awaiting";
  }
  if (profit.qualifyingSettledCount > 0 || profit.qualifyingOpenCount > 0) {
    return "qualifying";
  }
  if (offer.status === "planned" || offer.betCount === 0) return "planned";
  return "qualifying";
}

export function offerPipelineHasStarted(offer: OfferSummary): boolean {
  return deriveOfferPipelineStage(offer) !== "planned";
}

export function pipelineStageIndex(stage: OfferPipelineStage): number {
  if (stage === "expired") return -1;
  const idx = OFFER_PIPELINE_STAGES.findIndex((s) => s.id === stage);
  return idx >= 0 ? idx : 0;
}
