/**
 * Mistake ledger aggregation (B7) - "where my leak is". Sums the £ lost
 * (expected − realised, when positive) per mistake tag per month across
 * settled, tagged EV snapshots. Feeds the Monthly Edge Report (B8).
 */

import type { EvSnapshotRow } from "@/lib/offers/ev-capture";

export interface MistakeAggregateRow {
  /** YYYY-MM (local) */
  month: string;
  tag: string;
  lostGbp: number;
  count: number;
}

export function mistakeTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    laid_late: "Laid late",
    wrong_market: "Wrong market",
    odds_moved: "Odds moved",
    bookie_voided: "Bookie voided",
    other: "Other",
  };
  return labels[tag] ?? tag;
}

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Newest month first, then largest leak first within the month. */
export function aggregateMistakes(snapshots: EvSnapshotRow[]): MistakeAggregateRow[] {
  const byKey = new Map<string, MistakeAggregateRow>();

  for (const snap of snapshots) {
    if (snap.mistakeTag == null || snap.settledAt == null) continue;
    const lost = snap.expectedProfit - (snap.realizedProfit ?? 0);
    if (!(lost > 0)) continue; // over-capture is not a leak

    const month = monthKey(snap.settledAt);
    const key = `${month}:${snap.mistakeTag}`;
    const row = byKey.get(key) ?? {
      month,
      tag: snap.mistakeTag,
      lostGbp: 0,
      count: 0,
    };
    row.lostGbp = Math.round((row.lostGbp + lost) * 100) / 100;
    row.count += 1;
    byKey.set(key, row);
  }

  return [...byKey.values()].sort(
    (a, b) => b.month.localeCompare(a.month) || b.lostGbp - a.lostGbp
  );
}
