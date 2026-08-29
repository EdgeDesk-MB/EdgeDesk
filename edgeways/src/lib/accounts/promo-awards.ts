/**
 * Promo free-bet credits keyed by bet id. Pure: works on SQLite or Neon rows.
 */
export type PromoAward = { amount: number; reason: string };

export function promoAwardsFromTransactions(
  txs: ReadonlyArray<{
    category: string | null;
    betId: number | null;
    amount: number;
    note: string | null;
  }>
): Record<number, PromoAward> {
  const map: Record<number, PromoAward> = {};
  for (const tx of txs) {
    if (tx.category !== "free_bet" || tx.betId == null || tx.amount <= 0) continue;
    if (map[tx.betId]) continue;
    const reasonMatch = tx.note?.match(/Free bet promo - (.+?) \(/);
    map[tx.betId] = {
      amount: tx.amount,
      reason: reasonMatch?.[1]?.trim() ?? "Free bet awarded",
    };
  }
  return map;
}
