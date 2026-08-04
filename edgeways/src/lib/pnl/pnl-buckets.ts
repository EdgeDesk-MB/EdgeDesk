/**
 * Total P&L is Betting + Casino + manual adjustments.
 * Buckets stay separate so the UI can show them apart later.
 */
import { roundPence } from "@/lib/calc/money";

export type BettingPnlBet = {
  status: string;
  actualProfit: number | null;
};

export type CasinoPnlOffer = {
  status: string;
  actualProfit: number | null;
};

export type ManualPnlAdjustment = {
  amount: number | null;
};

export type PnlBuckets = {
  /** Settled sports/matched bets (excludes void/open). */
  bettingProfit: number;
  /** Completed casino campaigns' realised net profit. */
  casinoProfit: number;
  /** Manual top-ups/adjustments flagged affectPnl. */
  adjustmentProfit: number;
  /** betting + casino + adjustments. */
  settledProfit: number;
};

export function bettingProfitFromBets(bets: BettingPnlBet[]): number {
  let total = 0;
  for (const b of bets) {
    if (b.status === "open" || b.status === "void" || b.actualProfit == null) continue;
    total += b.actualProfit;
  }
  return roundPence(total);
}

export function casinoProfitFromOffers(offers: CasinoPnlOffer[]): number {
  let total = 0;
  for (const o of offers) {
    if (o.status !== "completed" || o.actualProfit == null) continue;
    total += o.actualProfit;
  }
  return roundPence(total);
}

export function adjustmentProfitFromHistory(rows: ManualPnlAdjustment[]): number {
  let total = 0;
  for (const h of rows) {
    if (h.amount == null) continue;
    total += h.amount;
  }
  return roundPence(total);
}

export function computePnlBuckets(input: {
  bets: BettingPnlBet[];
  casinoOffers: CasinoPnlOffer[];
  adjustments: ManualPnlAdjustment[];
}): PnlBuckets {
  const bettingProfit = bettingProfitFromBets(input.bets);
  const casinoProfit = casinoProfitFromOffers(input.casinoOffers);
  const adjustmentProfit = adjustmentProfitFromHistory(input.adjustments);
  return {
    bettingProfit,
    casinoProfit,
    adjustmentProfit,
    settledProfit: roundPence(bettingProfit + casinoProfit + adjustmentProfit),
  };
}
