import type { OfferImportantTerms } from "@/lib/offers/offer-terms";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";
import {
  archetypeLabel,
  buildExpectedProfit,
  buildImportantHints,
  buildInstructions,
  classifyOfferArchetype,
} from "./knowledge";
import { extractOfferSignals } from "./signals";
import type {
  OfferIntelligenceContext,
  OfferIntelligenceResult,
  OfferIntelligenceConfidence,
} from "./types";

export type { OfferIntelligenceResult, OfferArchetype } from "./types";
export { FREE_BET_EV_RETENTION } from "./estimates";

function mergeImportantNotes(existing: string, hints: string[]): string {
  const parts = existing
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const hint of hints) {
    const norm = hint.toLowerCase();
    if (!parts.some((p) => p.toLowerCase() === norm || p.toLowerCase().includes(norm))) {
      parts.push(hint);
    }
  }
  return parts.join(" · ");
}

function appendWorkflowToNotes(notes: string, instructions: string[]): string {
  if (instructions.length === 0) return notes;
  const workflow = instructions.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const block = `How to match:\n${workflow}`;
  if (notes.includes("How to match:")) return notes;
  return notes ? `${notes}\n\n${block}` : block;
}

export function enrichImportantTerms(
  terms: OfferImportantTerms,
  intelligence: OfferIntelligenceResult
): OfferImportantTerms {
  const mergedHints = mergeImportantNotes(terms.importantNotes, intelligence.importantHints);
  const withWorkflow = appendWorkflowToNotes(mergedHints, intelligence.instructions);
  return {
    ...terms,
    importantNotes: normalizeOfferDetailsText(withWorkflow),
  };
}

function resolveConfidence(
  archetypeScore: number,
  archetype: OfferIntelligenceResult["archetype"]
): OfferIntelligenceConfidence {
  if (archetype === "unknown") return "low";
  if (archetypeScore >= 5) return "high";
  if (archetypeScore >= 3) return "medium";
  return "low";
}

/** Analyze pasted offer text and return MB guidance + EV estimates. */
export function analyzeOfferIntelligence(
  ctx: OfferIntelligenceContext
): OfferIntelligenceResult {
  const signals = extractOfferSignals(ctx.text);
  const match = classifyOfferArchetype(ctx.text, { ...ctx, signals });
  const archetype = match.archetype;
  const { profit, explanation } = buildExpectedProfit(archetype, ctx, signals);
  const instructions = buildInstructions(archetype, ctx, signals);
  const importantHints = buildImportantHints(archetype, ctx, signals);

  return {
    archetype,
    archetypeLabel: archetypeLabel(archetype),
    confidence: resolveConfidence(match.score, archetype),
    signals,
    expectedProfit: profit,
    epExplanation: explanation,
    instructions,
    importantHints,
  };
}
