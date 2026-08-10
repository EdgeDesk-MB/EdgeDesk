import {
  isDefaultScopes,
  normalizeScopes,
  scopesNeedMinSelections,
  type BetScope,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";
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
  OfferIntelligenceSignals,
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
  if (notes.includes("How to match:")) return notes;
  // Keep short — structured Important fields hold deposit/code/WR facts.
  const workflow = instructions
    .slice(0, 4)
    .map((s, i) => `${i + 1}. ${s.slice(0, 100)}`)
    .join("\n");
  const block = `How to match:\n${workflow}`;
  return notes ? `${notes}\n\n${block}` : block;
}

function suggestedQualifierScopes(signals: OfferIntelligenceSignals): BetScope[] {
  if (signals.singlesOnly) return [];
  if (signals.accaOrBetBuilder) return ["acca", "bet_builder"];
  const out: BetScope[] = [];
  if (signals.multisOnly || signals.accaMention || signals.minSelections != null) {
    out.push("acca");
  }
  if (signals.betBuilderMention) out.push("bet_builder");
  return out.length > 0 ? normalizeScopes(out) : [];
}

function suggestedRewardScopes(signals: OfferIntelligenceSignals): BetScope[] {
  // Reward scopes only from free-bet / reward wording, not qualifier titles.
  if (signals.rewardAccaOrBetBuilder) return ["acca", "bet_builder"];
  const out: BetScope[] = [];
  if (signals.rewardAcca) out.push("acca");
  if (signals.rewardBetBuilder) out.push("bet_builder");
  return out.length > 0 ? normalizeScopes(out) : [];
}

export function enrichImportantTerms(
  terms: OfferImportantTerms,
  intelligence: OfferIntelligenceResult
): OfferImportantTerms {
  const mergedHints = mergeImportantNotes(terms.importantNotes, intelligence.importantHints);
  const withWorkflow = appendWorkflowToNotes(mergedHints, intelligence.instructions);
  const { signals } = intelligence;

  const qualifierScopes = isDefaultScopes(terms.qualifierScopes)
    ? (() => {
        const suggested = suggestedQualifierScopes(signals);
        return suggested.length > 0 ? suggested : terms.qualifierScopes;
      })()
    : terms.qualifierScopes;

  const rewardScopes = isDefaultScopes(terms.rewardScopes)
    ? (() => {
        const suggested = suggestedRewardScopes(signals);
        return suggested.length > 0 ? suggested : terms.rewardScopes;
      })()
    : terms.rewardScopes;

  return {
    ...terms,
    importantNotes: normalizeOfferDetailsText(withWorkflow),
    qualifierScopes,
    rewardScopes,
    minSelections:
      terms.minSelections ??
      (scopesNeedMinSelections(qualifierScopes) ? signals.minSelections : null),
    rewardMinSelections:
      terms.rewardMinSelections ??
      (scopesNeedMinSelections(rewardScopes) ? signals.minSelections : null),
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
