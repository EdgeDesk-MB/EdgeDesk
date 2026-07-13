import "server-only";
import { eq, and } from "drizzle-orm";
import { db, offerEvSnapshots } from "@/lib/db";
import { estimateOfferRemainingEv } from "@/lib/offers/advantage";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import type { OfferSummary } from "@/lib/services/offers.types";

/** Read all snapshots for one offer, sorted version asc. */
export function getSnapshotsForOffer(offerId: number): EvSnapshotRow[] {
  return db
    .select()
    .from(offerEvSnapshots)
    .where(eq(offerEvSnapshots.offerId, offerId))
    .all()
    .sort((a, b) => a.version - b.version) as EvSnapshotRow[];
}

/** Read all snapshots across all offers (for bulk assembly). */
export function getAllSnapshots(): EvSnapshotRow[] {
  return db.select().from(offerEvSnapshots).all() as EvSnapshotRow[];
}

/**
 * Write an EV lock snapshot for an offer.
 * - If no snapshot exists: writes version 1.
 * - If a snapshot exists and the offer is not settled: writes a new version
 *   (unless `onlyIfUnlocked`, which no-ops when any snapshot exists).
 * - If a snapshot exists and settled_at is already set: no-op (never mutate settled locks).
 *
 * Returns the version written, or null if no write happened.
 */
export function writeEvLock(
  offer: OfferSummary,
  opts?: {
    /** Override the expectedProfit to lock (defaults to estimateOfferRemainingEv). */
    expectedProfit?: number;
    retention?: number;
    retentionSampleSize?: number;
    /** Activation semantics: write v1 only if no snapshot exists, never re-version. */
    onlyIfUnlocked?: boolean;
  }
): number | null {
  const existing = getSnapshotsForOffer(offer.id);
  const latest = existing.length > 0
    ? existing.reduce((best, s) => (s.version > best.version ? s : best))
    : null;

  if (opts?.onlyIfUnlocked && latest != null) return null;

  // If latest snapshot is already settled, don't add more versions.
  if (latest?.settledAt != null) return null;

  const advOpts = opts?.retention != null
    ? { retention: opts.retention, retentionSampleSize: opts.retentionSampleSize }
    : undefined;
  const estimate = estimateOfferRemainingEv(offer, advOpts);
  const expectedProfit = opts?.expectedProfit ?? estimate.remainingEv;
  const basis = estimate.basis;

  const version = latest ? latest.version + 1 : 1;
  const inputsJson = JSON.stringify({
    autoLocked: opts?.expectedProfit == null,
    ...(advOpts?.retention != null ? { retentionUsed: advOpts.retention } : {}),
    ...(offer.profit.freeBetAwardAmount != null
      ? { freeBetAmount: offer.profit.freeBetAwardAmount }
      : {}),
  });

  db.insert(offerEvSnapshots)
    .values({
      offerId: offer.id,
      version,
      lockedAt: Date.now(),
      expectedProfit,
      basis,
      inputsJson,
    })
    .run();

  return version;
}

/**
 * Fill in settlement data on the latest snapshot for an offer.
 * Idempotent: does nothing if settledAt is already set.
 */
export function fillSettlementSnapshot(
  offerId: number,
  realizedProfit: number,
  commissionDrag: number
): void {
  const snapshots = getSnapshotsForOffer(offerId);
  if (snapshots.length === 0) return;

  const latest = snapshots.reduce((best, s) => (s.version > best.version ? s : best));
  if (latest.settledAt != null) return; // already filled

  const capturePct =
    Math.abs(latest.expectedProfit) > 0.01
      ? Math.min(realizedProfit / latest.expectedProfit, 2) // clamp at 2× for display sanity
      : null;

  db.update(offerEvSnapshots)
    .set({
      realizedProfit,
      capturePct,
      commissionDrag,
      settledAt: Date.now(),
    })
    .where(
      and(
        eq(offerEvSnapshots.offerId, offerId),
        eq(offerEvSnapshots.version, latest.version)
      )
    )
    .run();
}
