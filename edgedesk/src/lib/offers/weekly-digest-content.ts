/**
 * Weekly digest content (H1) - pure, client-safe composition over the same
 * tested aggregations the Edge Report uses. Returns null for an empty week:
 * the digest opens the week for you, it never nags.
 */

import { commissionPaidOnSettledBet, type CommissionPaidInput } from "@/lib/calc/commission-paid";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import { mistakeTagLabel } from "@/lib/offers/mistakes";

export type DigestBet = CommissionPaidInput & { settledAt: number | null };

export type DigestLeagueRow = { name: string; droughtNudge: boolean };

export interface WeeklyDigestContent {
  title: string;
  body: string;
}

function gbp(value: number): string {
  return value < 0 ? `-£${Math.abs(value).toFixed(2)}` : `+£${value.toFixed(2)}`;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function buildWeeklyDigest(input: {
  snapshots: EvSnapshotRow[];
  bets: DigestBet[];
  league: DigestLeagueRow[];
  weekStartMs: number;
  weekEndMs: number;
}): WeeklyDigestContent | null {
  const { snapshots, bets, league, weekStartMs, weekEndMs } = input;
  const inWindow = (t: number | null): boolean =>
    t != null && t >= weekStartMs && t < weekEndMs;

  const settled = snapshots.filter((s) => inWindow(s.settledAt));
  if (settled.length === 0) return null;

  const expected = round2(settled.reduce((a, s) => a + s.expectedProfit, 0));
  const realized = round2(settled.reduce((a, s) => a + (s.realizedProfit ?? 0), 0));
  const capture = Math.abs(expected) > 0.01 ? realized / expected : null;

  const drag = round2(
    bets
      .filter((b) => b.status !== "open" && inWindow(b.settledAt))
      .reduce((a, b) => a + commissionPaidOnSettledBet(b), 0)
  );

  // Window-local leak aggregation (aggregateMistakes is month-keyed; a week
  // can straddle two months). Same rule: leak = expected − realised when > 0.
  const leaks = new Map<string, number>();
  for (const s of settled) {
    if (!s.mistakeTag) continue;
    const lost = s.expectedProfit - (s.realizedProfit ?? 0);
    if (!(lost > 0)) continue;
    leaks.set(s.mistakeTag, (leaks.get(s.mistakeTag) ?? 0) + lost);
  }
  const topLeak = [...leaks.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const droughts = league.filter((l) => l.droughtNudge).map((l) => l.name);

  const title =
    capture != null
      ? `Your week: ${gbp(realized)} captured (${Math.round(capture * 100)}%)`
      : `Your week: ${gbp(realized)}`;

  const lines: string[] = [];
  let headline = `Expected ${gbp(expected)} → realised ${gbp(realized)}`;
  if (drag > 0) headline += ` · commission £${drag.toFixed(2)}`;
  lines.push(headline);
  if (topLeak) {
    lines.push(`Biggest leak: ${mistakeTagLabel(topLeak[0])} (-£${round2(topLeak[1]).toFixed(2)})`);
  }
  if (droughts.length > 0) {
    const named = droughts.slice(0, 2).join(", ");
    const more = droughts.length > 2 ? `, +${droughts.length - 2} more` : "";
    lines.push(`No offers lately: ${named}${more}`);
  }

  return { title, body: lines.join("\n") };
}
