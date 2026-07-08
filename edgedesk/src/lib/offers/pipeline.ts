import type { OfferSummary } from "@/lib/services/offers";

export type OfferPipelineStage =
  | "planned"
  | "qualifying"
  | "awaiting"
  | "awarded"
  | "converting"
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
  { id: "settled", label: "Settled" },
];

/** Map offer + profit breakdown to a campaign pipeline stage. */
export function deriveOfferPipelineStage(offer: OfferSummary): OfferPipelineStage {
  if (offer.status === "expired") return "expired";
  if (offer.status === "completed") return "settled";

  const { profit } = offer;

  if (profit.freeBetStage === "settled") return "settled";
  if (profit.freeBetStage === "in_use") return "converting";
  if (profit.freeBetStage === "awarded") return "awarded";
  if (profit.freeBetStage === "awaiting_result") return "awaiting";
  if (profit.qualifyingOpenCount > 0) return "qualifying";
  if (profit.qualifyingSettledCount > 0 && profit.freeBetStage === "not_awarded") {
    return "settled";
  }
  if (profit.qualifyingSettledCount > 0 || profit.qualifyingOpenCount > 0) {
    return "qualifying";
  }
  if (offer.status === "planned" || offer.betCount === 0) return "planned";
  return "qualifying";
}

export function pipelineStageIndex(stage: OfferPipelineStage): number {
  if (stage === "expired") return -1;
  const idx = OFFER_PIPELINE_STAGES.findIndex((s) => s.id === stage);
  return idx >= 0 ? idx : 0;
}
