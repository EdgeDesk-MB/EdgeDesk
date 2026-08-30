/**
 * Hosted EV lock / Edge report baselines. Clerk-scoped so two customers
 * never share a campaign lock.
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { estimateOfferRemainingEv } from "@/lib/offers/advantage";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { offerEvSnapshots as pgSnapshots } from "@/lib/db/schema.pg";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { MistakeTag } from "@/lib/services/ev-snapshot";

function requireClerk(action: string): string {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) throw new Error(`Sign in to ${action}.`);
  return clerkUserId;
}

function toRow(row: typeof pgSnapshots.$inferSelect): EvSnapshotRow {
  return {
    id: row.id,
    offerId: row.offerId,
    version: row.version,
    lockedAt: row.lockedAt,
    expectedProfit: row.expectedProfit,
    basis: row.basis as EvSnapshotRow["basis"],
    inputsJson: row.inputsJson,
    realizedProfit: row.realizedProfit,
    capturePct: row.capturePct,
    commissionDrag: row.commissionDrag,
    settledAt: row.settledAt,
    mistakeTag: row.mistakeTag,
  };
}

export async function listNeonSnapshotsForOffer(offerId: number): Promise<EvSnapshotRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgSnapshots)
    .where(and(eq(pgSnapshots.clerkUserId, clerkUserId), eq(pgSnapshots.offerId, offerId)));
  return rows.map(toRow).sort((a, b) => a.version - b.version);
}

export async function listNeonAllSnapshots(): Promise<EvSnapshotRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  const rows = await getNeonDb()
    .select()
    .from(pgSnapshots)
    .where(eq(pgSnapshots.clerkUserId, clerkUserId));
  return rows.map(toRow);
}

export async function writeNeonEvLock(
  offer: OfferSummary,
  opts?: {
    expectedProfit?: number;
    retention?: number;
    retentionSampleSize?: number;
    onlyIfUnlocked?: boolean;
  }
): Promise<number | null> {
  const clerkUserId = requireClerk("lock offer EV");
  const existing = await listNeonSnapshotsForOffer(offer.id);
  const latest =
    existing.length > 0
      ? existing.reduce((best, s) => (s.version > best.version ? s : best))
      : null;
  if (opts?.onlyIfUnlocked && latest != null) return null;
  if (latest?.settledAt != null) return null;

  const advOpts =
    opts?.retention != null
      ? { retention: opts.retention, retentionSampleSize: opts.retentionSampleSize }
      : undefined;
  const estimate = estimateOfferRemainingEv(offer, advOpts);
  const expectedProfit = opts?.expectedProfit ?? estimate.remainingEv;
  const version = latest ? latest.version + 1 : 1;
  const inputsJson = JSON.stringify({
    autoLocked: opts?.expectedProfit == null,
    ...(advOpts?.retention != null ? { retentionUsed: advOpts.retention } : {}),
    ...(offer.profit.freeBetAwardAmount != null
      ? { freeBetAmount: offer.profit.freeBetAwardAmount }
      : {}),
  });

  await getNeonDb().insert(pgSnapshots).values({
    offerId: offer.id,
    version,
    lockedAt: Date.now(),
    expectedProfit,
    basis: estimate.basis,
    inputsJson,
    clerkUserId,
  });
  return version;
}

export async function fillNeonSettlementSnapshot(
  offerId: number,
  realizedProfit: number,
  commissionDrag: number
): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  const snapshots = await listNeonSnapshotsForOffer(offerId);
  if (snapshots.length === 0) return;
  const latest = snapshots.reduce((best, s) => (s.version > best.version ? s : best));
  if (latest.settledAt != null) return;
  const capturePct =
    Math.abs(latest.expectedProfit) > 0.01
      ? Math.min(realizedProfit / latest.expectedProfit, 2)
      : null;
  await getNeonDb()
    .update(pgSnapshots)
    .set({
      realizedProfit,
      capturePct,
      commissionDrag,
      settledAt: Date.now(),
    })
    .where(
      and(
        eq(pgSnapshots.clerkUserId, clerkUserId),
        eq(pgSnapshots.offerId, offerId),
        eq(pgSnapshots.version, latest.version)
      )
    );
}

/**
 * Tag (or clear) the latest SETTLED snapshot. Same rules as localhost
 * `setMistakeTag`: no write when nothing is settled yet.
 */
export async function setNeonMistakeTag(
  offerId: number,
  tag: MistakeTag | null
): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  const snapshots = await listNeonSnapshotsForOffer(offerId);
  if (snapshots.length === 0) return false;
  const latest = snapshots.reduce((best, s) => (s.version > best.version ? s : best));
  if (latest.settledAt == null) return false;
  await getNeonDb()
    .update(pgSnapshots)
    .set({ mistakeTag: tag })
    .where(
      and(
        eq(pgSnapshots.clerkUserId, clerkUserId),
        eq(pgSnapshots.offerId, offerId),
        eq(pgSnapshots.version, latest.version)
      )
    );
  return true;
}
