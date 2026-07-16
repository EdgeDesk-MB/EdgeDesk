/**
 * Monthly Edge Report (B8) - the single chart that justifies the product:
 * cumulative EXPECTED edge (from A3 locks, stepped at lock time) vs
 * cumulative REALISED net P&L (stepped at settle time). Tracking together
 * means the edge is being captured; diverging means a leak - and the B7
 * mistake ledger says which.
 */

import type { BetRow } from "@/lib/db/schema";
import { commissionPaidOnSettledBet } from "@/lib/calc/commission-paid";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { aggregateMistakes, type MistakeAggregateRow } from "@/lib/offers/mistakes";

/** Fewer settled campaigns than this renders "not enough data", not noise. */
const MIN_CAMPAIGNS = 5;

export interface EdgeReportPoint {
  t: number;
  expected: number;
  realized: number;
}

export interface EdgeReportReady {
  kind: "ready";
  month: string;
  settledCampaigns: number;
  cumulative: EdgeReportPoint[];
  totals: { expected: number; realized: number; captureRate: number | null };
  /** Exchange commission paid across the month's settled bets */
  commissionDrag: number;
  /** Free-bet conversion retention for the month (face value = stake) */
  retention: { rate: number; sampleSize: number } | null;
  mistakes: MistakeAggregateRow[];
}

export interface EdgeReportInsufficient {
  kind: "insufficient";
  month: string;
  settledCampaigns: number;
  minCampaigns: number;
}

export type EdgeReport = EdgeReportReady | EdgeReportInsufficient;

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function monthsWithSettledCampaigns(snapshots: EvSnapshotRow[]): string[] {
  const months = new Set<string>();
  for (const s of snapshots) {
    if (s.settledAt != null) months.add(monthKey(s.settledAt));
  }
  return [...months].sort((a, b) => b.localeCompare(a));
}

export function buildEdgeReport(input: {
  snapshots: EvSnapshotRow[];
  bets: BetRow[];
  /** YYYY-MM */
  month: string;
  /** E1 tuning override; defaults to MIN_CAMPAIGNS */
  minCampaigns?: number;
}): EdgeReport {
  const { snapshots, bets, month } = input;
  const minCampaigns = input.minCampaigns ?? MIN_CAMPAIGNS;

  const settled = snapshots.filter(
    (s) => s.settledAt != null && monthKey(s.settledAt) === month
  );

  if (settled.length < minCampaigns) {
    return {
      kind: "insufficient",
      month,
      settledCampaigns: settled.length,
      minCampaigns,
    };
  }

  // Event timeline: expected steps at lock time, realised at settle time.
  type Step = { t: number; expected: number; realized: number };
  const steps: Step[] = [];
  for (const s of settled) {
    steps.push({ t: s.lockedAt, expected: s.expectedProfit, realized: 0 });
    steps.push({ t: s.settledAt!, expected: 0, realized: s.realizedProfit ?? 0 });
  }
  steps.sort((a, b) => a.t - b.t);

  let expected = 0;
  let realized = 0;
  const cumulative: EdgeReportPoint[] = steps.map((step) => {
    expected += step.expected;
    realized += step.realized;
    return { t: step.t, expected: round2(expected), realized: round2(realized) };
  });

  const totalExpected = round2(settled.reduce((a, s) => a + s.expectedProfit, 0));
  const totalRealized = round2(settled.reduce((a, s) => a + (s.realizedProfit ?? 0), 0));

  // J5: monthBets feeds commission drag and retention - edge metrics, so
  // camouflage bets are excluded (their money still counts in net P&L).
  const monthBets = bets.filter(
    (b) =>
      b.purpose !== "mug" &&
      b.settledAt != null &&
      b.status !== "open" &&
      monthKey(b.settledAt) === month
  );
  const commissionDrag = round2(
    monthBets.reduce((a, b) => a + commissionPaidOnSettledBet(b), 0)
  );

  const conversions = monthBets.filter(
    (b) =>
      (b.betType === "free_snr" || b.betType === "free_sr") &&
      b.status !== "void" &&
      b.backStake > 0
  );
  const faceTotal = conversions.reduce((a, b) => a + b.backStake, 0);
  const retained = conversions.reduce((a, b) => a + (b.actualProfit ?? 0), 0);
  const retention =
    conversions.length > 0 && faceTotal > 0
      ? { rate: round2(retained / faceTotal), sampleSize: conversions.length }
      : null;

  const mistakes = aggregateMistakes(settled).filter((m) => m.month === month);

  return {
    kind: "ready",
    month,
    settledCampaigns: settled.length,
    cumulative,
    totals: {
      expected: totalExpected,
      realized: totalRealized,
      captureRate:
        Math.abs(totalExpected) > 0.01 ? totalRealized / totalExpected : null,
    },
    commissionDrag,
    retention,
    mistakes,
  };
}
