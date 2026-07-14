import type { EvBasis } from "@/lib/offers/advantage";

export interface EvSnapshotRow {
  id: number;
  offerId: number;
  version: number;
  lockedAt: number;
  expectedProfit: number;
  basis: EvBasis;
  inputsJson: string | null;
  realizedProfit: number | null;
  capturePct: number | null;
  commissionDrag: number | null;
  settledAt: number | null;
  mistakeTag: string | null;
}

export interface EvCaptureSummary {
  expectedProfit: number;
  basis: EvBasis;
  version: number;
  /** null until settled */
  capturePct: number | null;
  /** null until settled */
  realizedProfit: number | null;
  lockedAt: number;
  /** B7 mistake tag on the settled snapshot, null = untagged */
  mistakeTag: string | null;
}

/** Return the latest snapshot's capture summary, or null if no snapshots exist. */
export function captureSummary(snapshots: EvSnapshotRow[]): EvCaptureSummary | null {
  if (snapshots.length === 0) return null;
  const latest = snapshots.reduce((best, s) => (s.version > best.version ? s : best));
  return {
    expectedProfit: latest.expectedProfit,
    basis: latest.basis,
    version: latest.version,
    capturePct: latest.capturePct,
    realizedProfit: latest.realizedProfit,
    lockedAt: latest.lockedAt,
    mistakeTag: latest.mistakeTag ?? null,
  };
}

/** Format the post-mortem capture line for settled offers. */
export function formatCaptureLine(summary: EvCaptureSummary): string | null {
  if (summary.capturePct == null || summary.realizedProfit == null) return null;
  const pct = Math.round(summary.capturePct * 100);
  const exp = summary.expectedProfit >= 0
    ? `+£${summary.expectedProfit.toFixed(2)}`
    : `-£${Math.abs(summary.expectedProfit).toFixed(2)}`;
  const real = summary.realizedProfit >= 0
    ? `+£${summary.realizedProfit.toFixed(2)}`
    : `-£${Math.abs(summary.realizedProfit).toFixed(2)}`;
  return `Expected ${exp} → Realized ${real} · ${pct}% captured`;
}
