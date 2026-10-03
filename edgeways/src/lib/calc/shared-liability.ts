/**
 * Shared liability: what an exchange actually locks for a set of open lays.
 *
 * Only one selection of a single-winner market can win, so lays covering
 * different results of that market do not each need their own liability in
 * the wallet. The exchange locks the worst result and nothing more. Lay
 * Norway and lay England in the same match and the two liabilities share.
 *
 * One reserve function serves three callers, so the Add bet funding check
 * cannot disagree with the balance it is comparing against:
 *   - `services/balances.ts` (SQLite desk)
 *   - `services/balance-summary.ts` (hosted Neon desk)
 *   - `components/add-bet/exchange-balance.tsx` (Add bet modal)
 *
 * The wallet a user sees is `free cash - exchangeReserve(open lays)`, which
 * is why {@link layFundingNeed} asks what the reserve becomes, not what one
 * lay costs in isolation.
 */

import { marketHasSingleWinner } from "@/lib/markets";
import { roundPence } from "./money";

export interface SharedLiabilityLay {
  /** Distinct per position: bet id for a logged lay, any sentinel for an unsaved one. */
  id: number | string;
  /** No linked event means we cannot prove two lays share a market. */
  eventId: number | null;
  market: string;
  selection: string;
  layStake: number;
  layOdds: number;
  /** Fraction, for example 0.02 for 2%. */
  commission: number;
}

/** The bet columns the reserve engine reads. Structural, so no db import. */
export interface SharedLiabilityBet {
  id: number;
  eventId: number | null;
  market: string;
  selection: string;
  layStake: number;
  layOdds: number;
  commission: number;
  status: string;
  balanceLedgered: number;
}

export interface LayFundingNeed {
  /** What this lay would lock on its own. */
  grossLiability: number;
  /** Extra exchange cash it locks on top of what the wallet already holds. */
  cashRequired: number;
  /** Liability covered by lays on other results of the same market. */
  sharedSaving: number;
  /** True when other lays on this market cover part of the liability. */
  shared: boolean;
}

/** A bet row read as a lay position. */
export function betLay(bet: Omit<SharedLiabilityBet, "status" | "balanceLedgered">): SharedLiabilityLay {
  return {
    id: bet.id,
    eventId: bet.eventId,
    market: bet.market,
    selection: bet.selection,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
  };
}

/**
 * The lay positions an exchange is holding right now: open bets whose stake
 * has been ledgered. Anything settled or unledgered locks nothing.
 */
export function openLedgeredLays(bets: SharedLiabilityBet[]): SharedLiabilityLay[] {
  return bets
    .filter((bet) => bet.status === "open" && !!bet.balanceLedgered)
    .map(betLay)
    .filter((lay) => layLiability(lay) > 0);
}

/** Cash at risk on one lay: stake x (odds - 1), to the penny. */
export function layLiability(
  lay: Pick<SharedLiabilityLay, "layStake" | "layOdds">
): number {
  if (!(lay.layStake > 0) || !(lay.layOdds > 1)) return 0;
  return roundPence(lay.layStake * (lay.layOdds - 1));
}

/** Backer stake kept when a lay wins, net of commission. */
function layWinnings(lay: SharedLiabilityLay): number {
  if (!(lay.layStake > 0) || !(lay.layOdds > 1)) return 0;
  const commission = Number.isFinite(lay.commission) ? lay.commission : 0;
  return roundPence(lay.layStake * (1 - Math.min(Math.max(commission, 0), 1)));
}

/**
 * Lays that can only share with each other: same event, same single-winner
 * market. Anything else, including lays with no event and markets where two
 * selections can land together, is keyed to itself so it keeps its full
 * liability. Reserving too much is the safe direction.
 */
function shareKey(lay: SharedLiabilityLay): string {
  if (lay.eventId == null) return `solo:${lay.id}`;
  if (!marketHasSingleWinner(lay.market)) return `solo:${lay.id}`;
  return `market:${lay.eventId}:${lay.market.trim()}`;
}

/**
 * Which result this lay rides on. Two lays on the same selection lose
 * together, so they share a bucket and their liabilities add up.
 *
 * A blank selection is keyed to the lay itself. Quick-logged lays can land
 * without one, and we cannot prove two of those are the same result.
 */
function outcomeKey(lay: SharedLiabilityLay): string {
  const selection = lay.selection.trim().toLowerCase();
  return selection ? `sel:${selection}` : `unknown:${lay.id}`;
}

/** Worst-case loss across the results of one single-winner market group. */
function groupReserve(lays: SharedLiabilityLay[]): number {
  const liabilityByOutcome = new Map<string, number>();
  const winningsByOutcome = new Map<string, number>();

  for (const lay of lays) {
    const key = outcomeKey(lay);
    liabilityByOutcome.set(
      key,
      roundPence((liabilityByOutcome.get(key) ?? 0) + layLiability(lay))
    );
    winningsByOutcome.set(
      key,
      roundPence((winningsByOutcome.get(key) ?? 0) + layWinnings(lay))
    );
  }

  const totalWinnings = roundPence(
    [...winningsByOutcome.values()].reduce((sum, w) => sum + w, 0)
  );

  // One laid result wins: that bucket's liability goes, every other lay in
  // the market wins its backer stake. A result nobody laid winning pays all
  // of them, which is never the worst case, so it needs no scenario.
  let worst = 0;
  for (const [key, liability] of liabilityByOutcome) {
    const others = roundPence(totalWinnings - (winningsByOutcome.get(key) ?? 0));
    const net = roundPence(others - liability);
    if (net < worst) worst = net;
  }

  return roundPence(-worst);
}

/** Cash an exchange locks for these open lays, with shared liability applied. */
export function exchangeReserve(lays: SharedLiabilityLay[]): number {
  const groups = new Map<string, SharedLiabilityLay[]>();
  for (const lay of lays) {
    if (layLiability(lay) <= 0) continue;
    const key = shareKey(lay);
    const group = groups.get(key);
    if (group) group.push(lay);
    else groups.set(key, [lay]);
  }

  let reserve = 0;
  for (const group of groups.values()) {
    reserve = roundPence(reserve + groupReserve(group));
  }
  return reserve;
}

/** Summed liabilities, which is what the ledger debited bet by bet. */
export function totalLayLiability(lays: SharedLiabilityLay[]): number {
  return roundPence(lays.reduce((sum, lay) => sum + layLiability(lay), 0));
}

/**
 * Liability debited bet by bet that the exchange does not actually lock, so
 * it can be credited back to the displayed wallet balance.
 */
export function sharedLiabilityReturn(lays: SharedLiabilityLay[]): number {
  return Math.max(0, roundPence(totalLayLiability(lays) - exchangeReserve(lays)));
}

/**
 * What a candidate lay needs from the wallet, given the lays already open on
 * the same exchange.
 *
 * `openLays` is the wallet's current position, including the lay under edit.
 * Give the candidate that lay's id to edit it in place; any other id adds it.
 * `cashRequired` is the rise in reserve, so it is directly comparable with
 * the balance the desk shows.
 */
export function layFundingNeed(
  openLays: SharedLiabilityLay[],
  candidate: SharedLiabilityLay
): LayFundingNeed {
  const grossLiability = layLiability(candidate);
  if (grossLiability <= 0) {
    return { grossLiability: 0, cashRequired: 0, sharedSaving: 0, shared: false };
  }

  // Without the lay under edit: the baseline the candidate is priced against.
  const baseline = openLays.filter((lay) => lay.id !== candidate.id);
  const next = [...baseline, candidate];

  const cashRequired = Math.max(
    0,
    roundPence(exchangeReserve(next) - exchangeReserve(openLays))
  );
  // The candidate's own cost once the other lays on its market are allowed
  // to cover it. Equal to the gross liability when nothing shares.
  const costAfterSharing = Math.max(
    0,
    roundPence(exchangeReserve(next) - exchangeReserve(baseline))
  );
  const sharedSaving = Math.max(0, roundPence(grossLiability - costAfterSharing));

  return {
    grossLiability,
    cashRequired,
    sharedSaving,
    shared: sharedSaving > 0.005,
  };
}
