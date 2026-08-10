/**
 * Acca Desk → platform provisional: when square on the next laid leg,
 * contribute the campaign worst/locked floor (not mid-leg History noise).
 */
import {
  accaSquareProvisional,
  type AccaSquareProvisional,
} from "@/lib/calc/acca-workflow";
import { roundPence } from "@/lib/calc/money";
import { isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import type { AccaLegRow, AccaRunRow, BetRow } from "@/lib/db/schema";

export type AccaRunForProvisional = {
  run: AccaRunRow;
  legs: AccaLegRow[];
  backBetType: string | null;
};

/** Active-run Acca desk lay bet ids — defer their settlements from settled P&L. */
export function activeAccaDeskLayBetIds(bundles: AccaRunForProvisional[]): Set<number> {
  const ids = new Set<number>();
  for (const { run, legs } of bundles) {
    if (run.status !== "active") continue;
    for (const leg of legs) {
      if (leg.layBetId != null) ids.add(leg.layBetId);
    }
    if (run.wholeLayBetId != null) ids.add(run.wholeLayBetId);
  }
  return ids;
}

export function accaRunSquareProvisional(
  bundle: AccaRunForProvisional
): AccaSquareProvisional | null {
  const { run, legs, backBetType } = bundle;
  if (run.status !== "active") return null;
  return accaSquareProvisional(
    {
      stake: run.stake,
      commission: run.commission,
      method: run.method,
      wholeLayStake: run.wholeLayStake,
      wholeLayOdds: run.wholeLayOdds,
      boostPct: run.boostPct,
      backBetType,
    },
    legs.map((l) => ({
      seq: l.seq,
      backOdds: l.backOdds,
      result: l.result,
      layStake: l.layStake,
      layOdds: l.layOdds,
    }))
  );
}

/** Sum square provisionals across active Acca runs. */
export function sumAccaSquareProvisional(bundles: AccaRunForProvisional[]): number {
  let total = 0;
  for (const bundle of bundles) {
    const p = accaRunSquareProvisional(bundle);
    if (p != null) total += p.value;
  }
  return roundPence(total);
}

/** True if this settled bet is an Acca desk lay on a still-active run. */
export function isDeferredAccaDeskLaySettlement(
  bet: Pick<BetRow, "id" | "label" | "betType" | "status">,
  activeLayIds: Set<number>
): boolean {
  if (bet.status === "open" || bet.status === "void") return false;
  if (!isAccaDeskLay(bet)) return false;
  return activeLayIds.has(bet.id);
}

/** Every back / leg-lay / whole-lay bet id linked to the given Acca runs. */
export function accaDeskLinkedBetIds(bundles: AccaRunForProvisional[]): Set<number> {
  const ids = new Set<number>();
  for (const { run, legs } of bundles) {
    if (run.backBetId != null) ids.add(run.backBetId);
    if (run.wholeLayBetId != null) ids.add(run.wholeLayBetId);
    for (const leg of legs) {
      if (leg.layBetId != null) ids.add(leg.layBetId);
    }
  }
  return ids;
}

/** Linked bet ids for completed Acca runs only (folded into one chart step). */
export function completedAccaDeskLinkedBetIds(
  bundles: AccaRunForProvisional[]
): Set<number> {
  return accaDeskLinkedBetIds(bundles.filter((b) => b.run.status === "completed"));
}

/** Bet ids for one Acca run (back + leg lays + whole lay). */
export function accaRunLinkedBetIds(bundle: AccaRunForProvisional): number[] {
  const ids: number[] = [];
  const { run, legs } = bundle;
  if (run.backBetId != null) ids.push(run.backBetId);
  if (run.wholeLayBetId != null) ids.push(run.wholeLayBetId);
  for (const leg of legs) {
    if (leg.layBetId != null) ids.push(leg.layBetId);
  }
  return ids;
}

/**
 * Consolidated Acca P&L from settled linked bets (History + Home chart).
 * Lays are History-silent, so the back settlement row must carry this net.
 */
export function accaCampaignSettledProfit(
  bundle: AccaRunForProvisional,
  betsById: Map<number, Pick<BetRow, "status" | "actualProfit">>
): number | null {
  let profit = 0;
  let any = false;
  for (const id of accaRunLinkedBetIds(bundle)) {
    const bet = betsById.get(id);
    if (!bet || bet.status === "open" || bet.status === "void") continue;
    if (bet.actualProfit == null) continue;
    any = true;
    profit += bet.actualProfit;
  }
  return any ? roundPence(profit) : null;
}

export type AccaSeriesPoint = {
  time: number;
  profit: number;
  commission: number;
};

/**
 * Completed Acca campaigns → one Home-chart step at `run.settledAt`.
 * Final lay + back settle at the same `Date.now()`; plotting them separately
 * draws a vertical drop then spike. Mid-run active lays stay deferred via
 * `isDeferredAccaDeskLaySettlement` until the run completes.
 */
export function completedAccaSeriesPoints(
  bundles: AccaRunForProvisional[],
  betsById: Map<number, Pick<BetRow, "status" | "actualProfit">>,
  commissionFor: (betId: number) => number
): AccaSeriesPoint[] {
  const points: AccaSeriesPoint[] = [];
  for (const bundle of bundles) {
    if (bundle.run.status !== "completed") continue;

    const profit = accaCampaignSettledProfit(bundle, betsById);
    if (profit == null) continue;

    let commission = 0;
    for (const id of accaRunLinkedBetIds(bundle)) {
      const bet = betsById.get(id);
      if (!bet || bet.status === "open" || bet.status === "void") continue;
      if (bet.actualProfit == null) continue;
      commission += commissionFor(id);
    }

    points.push({
      time: bundle.run.settledAt ?? bundle.run.createdAt,
      profit,
      commission: roundPence(commission),
    });
  }
  return points;
}
