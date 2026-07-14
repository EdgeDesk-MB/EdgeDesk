import "server-only";
import { inArray } from "drizzle-orm";
import { db, bets, balanceTransactions } from "@/lib/db";
import { targetedLotId } from "@/lib/accounts/free-bet-lot-balance";
import { blendedRetention } from "@/lib/offers/retention-shared";

export interface RealizedRetention {
  /** Blended retention rate (0–1). Falls back to 0.8 prior when sampleSize < 5. */
  rate: number;
  /** Number of settled conversion bets used in the measurement. */
  sampleSize: number;
  /** Bets skipped because no face value could be resolved. */
  skipped: number;
}

/**
 * Compute the user's measured free-bet conversion retention from settled history.
 *
 * Retention = sum(actualProfit) / sum(face_value) over settled free_snr / free_sr bets.
 * Face value resolution: [[lot:N]] marker → balance_transactions.amount,
 * else bet.backStake (reliable for SNR bets placed at face value).
 *
 * Half results (half_win / half_lose / push) are included at face value since
 * actualProfit already reflects the half outcome.
 * Void bets are excluded entirely.
 */
export function getRealizedRetention(
  windowDays?: number,
  /** E1 tuning: Bayesian prior + pseudo-sample weight (defaults 0.8 / 5) */
  prior?: { rate: number; weight: number }
): RealizedRetention {
  const FREE_BET_TYPES = ["free_snr", "free_sr"] as const;
  const EXCLUDED_STATUSES = ["open", "void"] as const;

  const cutoff = windowDays ? Date.now() - windowDays * 24 * 60 * 60 * 1000 : 0;

  const conversionBets = db
    .select()
    .from(bets)
    .all()
    .filter(
      (b) =>
        (FREE_BET_TYPES as readonly string[]).includes(b.betType) &&
        !(EXCLUDED_STATUSES as readonly string[]).includes(b.status) &&
        b.actualProfit != null &&
        (cutoff === 0 || (b.settledAt ?? b.createdAt) >= cutoff)
    );

  if (conversionBets.length === 0) {
    return { rate: blendedRetention(0, 0, prior?.rate, prior?.weight), sampleSize: 0, skipped: 0 };
  }

  // Resolve lot amounts for bets that carry a [[lot:N]] marker
  const lotIds = conversionBets
    .map((b) => targetedLotId(b.notes))
    .filter((id): id is number => id !== null);

  const lotAmountById = new Map<number, number>();
  if (lotIds.length > 0) {
    const txRows = db
      .select()
      .from(balanceTransactions)
      .where(inArray(balanceTransactions.id, lotIds))
      .all();
    for (const tx of txRows) {
      lotAmountById.set(tx.id, Math.abs(tx.amount));
    }
  }

  let totalRetained = 0;
  let totalFaceValue = 0;
  let sampleSize = 0;
  let skipped = 0;

  for (const bet of conversionBets) {
    let faceValue: number | null = null;

    // 1. Lot marker
    const lotId = targetedLotId(bet.notes);
    if (lotId !== null && lotAmountById.has(lotId)) {
      faceValue = lotAmountById.get(lotId)!;
    }

    // 2. Back stake (free-bet stake = face value for SNR bets)
    if (faceValue == null && bet.backStake > 0) {
      faceValue = bet.backStake;
    }

    if (faceValue == null || faceValue < 0.01) {
      skipped++;
      continue;
    }

    totalRetained += bet.actualProfit!;
    totalFaceValue += faceValue;
    sampleSize++;
  }

  if (sampleSize === 0 || totalFaceValue < 0.01) {
    return { rate: blendedRetention(0, 0, prior?.rate, prior?.weight), sampleSize: 0, skipped };
  }

  const measuredRate = Math.max(0, totalRetained / totalFaceValue);
  const rate = blendedRetention(measuredRate, sampleSize, prior?.rate, prior?.weight);

  return { rate, sampleSize, skipped };
}
