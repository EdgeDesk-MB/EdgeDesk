/**
 * Pure offer profit maths: no SQLite, no server-only. Extracted verbatim from
 * services/offers.ts so the hosted (Neon) desk can summarise campaigns without
 * opening the local database. `promoAwards` is required here - the SQLite
 * default lives on the services/offers.ts wrapper.
 */
import type { BetRow, OfferRow } from "@/lib/db/schema";
import { aiEffectsForBet, isLossFreeBetEffect, isPlaceFreeBetEffect } from "@/lib/calc/ai-triggers";
import type {
  FreeBetStage,
  OfferProfitBreakdown,
  OfferSummary,
} from "@/lib/services/offers.types";

function isQualifyingBet(bet: BetRow): boolean {
  return bet.betType === "qualifying" || bet.betType === "risk_free";
}

function isFreeBetUsage(bet: BetRow): boolean {
  return bet.betType === "free_snr" || bet.betType === "free_sr";
}

function settledProfit(bets: BetRow[]): number {
  return bets
    .filter((b) => b.status !== "open" && b.status !== "void" && b.status !== "push" && b.actualProfit != null)
    .reduce((a, b) => a + (b.actualProfit ?? 0), 0);
}

function openExpectedProfit(bets: BetRow[]): number {
  return bets
    .filter((b) => b.status === "open" && b.expectedProfit != null)
    .reduce((a, b) => a + (b.expectedProfit ?? 0), 0);
}

/** Free-bet award amount implied by label/trigger (even if wallet credit failed). */
export function expectedFreeBetAmountFromBet(bet: BetRow): number | null {
  const fromRuleOrLabel = aiEffectsForBet(bet.triggerRule, bet.label);
  const fromTriggerText = bet.triggerText?.trim()
    ? aiEffectsForBet(null, bet.triggerText)
    : [];
  const effects = fromRuleOrLabel.length > 0 ? fromRuleOrLabel : fromTriggerText;
  const award = effects.find((e) => e.kind === "free_bet_award");
  return award && award.amount > 0 ? award.amount : null;
}

function freeBetEffectsForBet(bet: BetRow) {
  const fromRuleOrLabel = aiEffectsForBet(bet.triggerRule, bet.label);
  if (fromRuleOrLabel.length > 0) return fromRuleOrLabel;
  if (bet.triggerText?.trim()) return aiEffectsForBet(null, bet.triggerText);
  return [];
}

function betHasPlaceFreeBetTrigger(bet: BetRow): boolean {
  return freeBetEffectsForBet(bet).some(isPlaceFreeBetEffect);
}

function betHasUnconditionalFreeBet(bet: BetRow): boolean {
  return freeBetEffectsForBet(bet).some(
    (e) =>
      e.kind === "free_bet_award" && e.positions.length === 0 && !e.awardOnLoss
  );
}

function betHasLossRefundTrigger(bet: BetRow): boolean {
  return bet.betType === "risk_free" || freeBetEffectsForBet(bet).some(isLossFreeBetEffect);
}

function betTimeKey(bet: Pick<BetRow, "id" | "createdAt">): number {
  return bet.createdAt > 0 ? bet.createdAt : bet.id;
}

/**
 * Promo awards on qualifying bets that have no free-bet usage at/after them.
 * An earlier convert must not hide a later unused award (Betfair Acca re-qualify).
 */
function firstUnconvertedPromoAward(
  qualifying: BetRow[],
  freeBetBets: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }>
): { betId: number; amount: number; reason: string } | null {
  const awards = qualifying
    .filter((b) => promoAwards[b.id])
    .sort((a, b) => betTimeKey(a) - betTimeKey(b) || a.id - b.id);
  if (awards.length === 0) return null;

  const usages = [...freeBetBets].sort(
    (a, b) => betTimeKey(a) - betTimeKey(b) || a.id - b.id
  );
  const used = new Set<number>();

  for (const awardBet of awards) {
    const awardKey = betTimeKey(awardBet);
    const usage = usages.find(
      (u) => !used.has(u.id) && (betTimeKey(u) > awardKey || (betTimeKey(u) === awardKey && u.id > awardBet.id))
    );
    if (!usage) {
      const promo = promoAwards[awardBet.id]!;
      return { betId: awardBet.id, amount: promo.amount, reason: promo.reason };
    }
    used.add(usage.id);
  }
  return null;
}

export function computeOfferProfitBreakdown(
  linkedInput: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }>
): OfferProfitBreakdown {
  // J5: camouflage bets are real money but never offer edge - excluded here
  // so EV capture, capture %, and the mistake ledger can't see them.
  const linked = linkedInput.filter((b) => b.purpose !== "mug");
  const qualifying = linked.filter(isQualifyingBet);
  const freeBetBets = linked.filter(isFreeBetUsage);

  const qualifyingSettled = qualifying.filter((b) => b.status !== "open" && b.status !== "void");
  const qualifyingOpen = qualifying.filter((b) => b.status === "open");
  const qualifyingProfit = settledProfit(qualifying);

  const freeBetSettled = freeBetBets.filter((b) => b.status !== "open" && b.status !== "void");
  const freeBetOpen = freeBetBets.filter((b) => b.status === "open");
  const freeBetProfit = settledProfit(freeBetBets);

  let freeBetAwarded = false;
  let freeBetAwardAmount: number | null = null;
  let freeBetAwardReason: string | null = null;

  const unconverted = firstUnconvertedPromoAward(qualifying, freeBetBets, promoAwards);
  if (unconverted) {
    freeBetAwarded = true;
    freeBetAwardAmount = unconverted.amount;
    freeBetAwardReason = unconverted.reason;
  } else {
    for (const bet of qualifying) {
      const promo = promoAwards[bet.id];
      if (!promo) continue;
      freeBetAwarded = true;
      freeBetAwardAmount = promo.amount;
      freeBetAwardReason = promo.reason;
      break;
    }
  }

  // Unconditional "Bet £X get £Y FB" - treat as awarded once qualifying settles,
  // even if the bookie wallet credit never landed (missing account, etc.).
  if (!freeBetAwarded && freeBetSettled.length === 0 && freeBetOpen.length === 0) {
    for (const bet of qualifyingSettled) {
      if (!betHasUnconditionalFreeBet(bet)) continue;
      const amount = expectedFreeBetAmountFromBet(bet);
      if (amount == null) continue;
      freeBetAwarded = true;
      freeBetAwardAmount = amount;
      freeBetAwardReason = "Offer unlocked";
      break;
    }
  }

  let freeBetStage: FreeBetStage = "none";
  const hasPlaceTrigger = qualifying.some(betHasPlaceFreeBetTrigger);
  const hasLossRefundTrigger = qualifying.some(betHasLossRefundTrigger);
  const hasAnyFreeBetTrigger = qualifying.some((b) => expectedFreeBetAmountFromBet(b) != null);

  if (freeBetOpen.length > 0) {
    freeBetStage = "in_use";
  } else if (unconverted) {
    // Later unused promo wins over an earlier settled convert on the same campaign.
    freeBetStage = "awarded";
  } else if (freeBetSettled.length > 0) {
    freeBetStage = "settled";
  } else if (freeBetAwarded) {
    freeBetStage = "awarded";
  } else if (hasPlaceTrigger && qualifyingOpen.length > 0) {
    freeBetStage = "awaiting_result";
  } else if (hasPlaceTrigger && qualifyingSettled.length > 0) {
    freeBetStage = "not_awarded";
  } else if (hasLossRefundTrigger && qualifyingOpen.length > 0) {
    freeBetStage = "awaiting_result";
  } else if (
    hasLossRefundTrigger &&
    qualifyingSettled.length > 0 &&
    qualifyingOpen.length === 0
  ) {
    const lost = qualifyingSettled.some(
      (b) => b.status === "lost" || b.status === "half_lose"
    );
    freeBetStage = lost ? "awaiting_result" : "not_awarded";
  } else if (hasAnyFreeBetTrigger && qualifyingOpen.length > 0) {
    freeBetStage = "awaiting_result";
  }

  const openExpected = openExpectedProfit(linked);

  return {
    qualifyingProfit,
    qualifyingSettledCount: qualifyingSettled.length,
    qualifyingOpenCount: qualifyingOpen.length,
    freeBetAwarded,
    freeBetAwardAmount,
    freeBetAwardReason,
    freeBetStage,
    freeBetProfit,
    freeBetOpenCount: freeBetOpen.length,
    freeBetSettledCount: freeBetSettled.length,
    openExpectedProfit: Math.round(openExpected * 100) / 100,
    totalProfit: Math.round((qualifyingProfit + freeBetProfit + openExpected) * 100) / 100,
  };
}

export function summariseOffer(
  offer: OfferRow,
  linkedInput: BetRow[],
  promoAwards: Record<number, { amount: number; reason: string }>
): OfferSummary {
  // J5: same exclusion as computeOfferProfitBreakdown (single-purpose rule).
  const linked = linkedInput.filter((b) => b.purpose !== "mug");
  const openBets = linked.filter((b) => b.status === "open").length;
  const profit = computeOfferProfitBreakdown(linked, promoAwards);
  const expectedFromBets = linked.reduce((a, b) => a + (b.expectedProfit ?? 0), 0);

  return {
    ...offer,
    betCount: linked.length,
    openBets,
    actualProfit: profit.totalProfit,
    expectedFromBets,
    profit,
  };
}
