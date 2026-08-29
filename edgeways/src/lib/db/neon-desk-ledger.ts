/**
 * Hosted cash ledger for bet place/settle, plus promo free-bet credits
 * (awardOnLoss / unconditional unlock). free_snr/free_sr still skip cash
 * stake debit; lot FIFO is derived from the free_bet rows.
 */
import "server-only";

import { ensureNeonVenueAccount } from "@/lib/db/neon-desk-ensure-venue";
import {
  insertNeonDeskTransaction,
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
  listNeonExchanges,
  purgeNeonDeskPlacementTransactionsForBet,
  purgeNeonDeskTransactionsForBet,
} from "@/lib/db/neon-desk-accounts";
import {
  claimNeonBetPlacementLedger,
  neonDeskClerkUserId,
  patchNeonDeskBet,
} from "@/lib/db/neon-desk";
import { insertNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { evaluateUnconditionalFreeBet, isPlaceFreeBetEffect } from "@/lib/calc/ai-triggers";
import {
  FREE_BET_EARNED_PHRASE,
  freeBetEffectsForBet,
} from "@/lib/offers/early-free-bet-award";
import type { AccountRow, BetRow } from "@/lib/db/schema";

function resolveOwner(clerkUserId?: string | null): string | null {
  return clerkUserId?.trim() || neonDeskClerkUserId();
}

async function neonBookieForBet(
  bet: BetRow,
  clerkUserId: string
): Promise<AccountRow | undefined> {
  if (!bet.bookmaker?.trim()) return undefined;
  const { account } = await ensureNeonVenueAccount(bet.bookmaker, "bookie", clerkUserId);
  return account;
}

async function neonExchangeForBet(
  bet: BetRow,
  clerkUserId: string
): Promise<AccountRow | undefined> {
  if (bet.exchangeId == null) return undefined;
  const accounts = await listNeonDeskAccounts(clerkUserId);
  const existing = accounts.find(
    (a) => a.type === "exchange" && a.exchangeId === bet.exchangeId && a.isActive === 1
  );
  if (existing) return existing;
  const exchanges = await listNeonExchanges();
  const ex = exchanges.find((e) => e.id === bet.exchangeId);
  if (!ex) return undefined;
  const { account } = await ensureNeonVenueAccount(ex.name, "exchange", clerkUserId);
  return account;
}

export function logNeonLedgerFailure(stage: string, betId: number, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[neon-ledger] ${stage} failed for bet ${betId}: ${message}`);
}

/** Debit back stake and lay liability when a hosted bet is saved. */
export async function ledgerNeonBetPlacement(
  bet: BetRow,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;
  // Idempotent: already written, or another worker holds the claim.
  if (bet.balanceLedgered) return true;
  if (bet.betType === "dutch") {
    await patchNeonDeskBet(bet.id, { balanceLedgered: 1 }, owner);
    return true;
  }

  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const bookie = await neonBookieForBet(bet, owner);
  const exchange = await neonExchangeForBet(bet, owner);
  if (!bookie && !exchange) return false;

  const claimed = await claimNeonBetPlacementLedger(bet.id, owner);
  // Lost the race: the winner writes (or has written) the stake rows.
  if (!claimed) return true;

  try {
    const liability = bet.layStake * (bet.layOdds - 1);
    const now = Date.now();

    if (bookie && bet.backStake > 0 && !isFree) {
      await insertNeonDeskTransaction(
        {
          accountId: bookie.id,
          amount: -bet.backStake,
          category: "bet_stake",
          note: `Back stake - ${bet.label}`,
          betId: bet.id,
          createdAt: now,
        },
        owner
      );
    }
    if (exchange && liability > 0) {
      await insertNeonDeskTransaction(
        {
          accountId: exchange.id,
          amount: -liability,
          category: "bet_stake",
          note: `Lay liability - ${bet.label}`,
          betId: bet.id,
          createdAt: now,
        },
        owner
      );
    }
    return true;
  } catch (error) {
    await purgeNeonDeskPlacementTransactionsForBet(bet.id, owner);
    await patchNeonDeskBet(bet.id, { balanceLedgered: 0 }, owner);
    throw error;
  }
}

/** Credit settlement payouts. Heals placement first so older un-ledgered bets still move cash. */
export async function ledgerNeonBetSettlement(
  bet: BetRow,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;
  const cashOk = await ledgerNeonCashSettlement(bet, owner);
  await awardNeonUnconditionalFreeBetIfDue(bet, owner);
  return cashOk;
}

async function ledgerNeonCashSettlement(
  bet: BetRow,
  owner: string
): Promise<boolean> {
  if (bet.balanceSettled) return false;
  if (!bet.balanceLedgered) {
    const placed = await ledgerNeonBetPlacement(bet, owner);
    if (!placed) return false;
    bet = { ...bet, balanceLedgered: 1 };
  }
  if (bet.betType === "dutch") {
    await patchNeonDeskBet(bet.id, { balanceSettled: 1 }, owner);
    return true;
  }

  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const bookie = await neonBookieForBet(bet, owner);
  const exchange = await neonExchangeForBet(bet, owner);
  if (!bookie && !exchange) return false;

  const liability = bet.layStake * (bet.layOdds - 1);
  const layWinnings = bet.layStake * (1 - bet.commission);
  const now = Date.now();

  if (bet.status === "void" || bet.status === "push") {
    if (bookie && bet.backStake > 0 && !isFree) {
      await insertNeonDeskTransaction(
        {
          accountId: bookie.id,
          amount: bet.backStake,
          category: "bet_settlement",
          note: `${bet.status === "push" ? "Push" : "Void"} - stake returned - ${bet.label}`,
          betId: bet.id,
          createdAt: now,
        },
        owner
      );
    }
    if (exchange && liability > 0) {
      await insertNeonDeskTransaction(
        {
          accountId: exchange.id,
          amount: liability,
          category: "bet_settlement",
          note: `${bet.status === "push" ? "Push" : "Void"} - liability returned - ${bet.label}`,
          betId: bet.id,
          createdAt: now,
        },
        owner
      );
    }
    await patchNeonDeskBet(bet.id, { balanceSettled: 1 }, owner);
    return true;
  }

  const early = bet.status === "early_payout";
  const half = bet.status === "half_win" || bet.status === "half_lose";
  const paid = bet.status === "won" || early;
  const bookieFactor = half ? 0.5 : paid ? 1 : 0;

  if (bookie && bookieFactor > 0 && !isFree) {
    let payout = bet.backStake * bet.backOdds;
    payout *= bookieFactor;
    if (payout > 0) {
      const label = half
        ? bet.status === "half_win"
          ? "half win"
          : "half lose"
        : early
          ? "2UP"
          : "back won";
      await insertNeonDeskTransaction(
        {
          accountId: bookie.id,
          amount: payout,
          category: "bet_settlement",
          note: `Bookie payout (${label}) - ${bet.label}`,
          betId: bet.id,
          createdAt: now,
        },
        owner
      );
    }
  } else if (bookie && bookieFactor > 0 && isFree) {
    let payout =
      bet.betType === "free_snr"
        ? bet.backStake * (bet.backOdds - 1)
        : bet.backStake * bet.backOdds;
    payout *= bookieFactor;
    if (payout > 0) {
      await insertNeonDeskTransaction(
        {
          accountId: bookie.id,
          amount: payout,
          category: "bet_settlement",
          note: `Bookie payout (free bet) - ${bet.label}`,
          betId: bet.id,
          createdAt: now,
        },
        owner
      );
    }
  }

  const layCreditFactor = half ? 0.5 : paid ? 0 : 1;
  if (exchange && layCreditFactor > 0 && bet.layStake > 0) {
    await insertNeonDeskTransaction(
      {
        accountId: exchange.id,
        amount: (liability + layWinnings) * layCreditFactor,
        category: "bet_settlement",
        note: half ? `Lay half settled - ${bet.label}` : `Lay won - ${bet.label}`,
        betId: bet.id,
        createdAt: now,
      },
      owner
    );
  }

  await patchNeonDeskBet(bet.id, { balanceSettled: 1 }, owner);
  return true;
}

/** Credit a promotional free-bet award. Idempotent on an existing credit for the bet. */
export async function ledgerNeonPromoAward(
  bet: BetRow,
  amount: number,
  reason: string,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  if (amount <= 0) return false;
  if (!bet.bookmaker?.trim()) return false;
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;

  const existing = await listNeonDeskBalanceTransactions(owner);
  if (existing.some((t) => t.betId === bet.id && t.category === "free_bet" && t.amount > 0)) {
    return false;
  }

  const bookie = await neonBookieForBet(bet, owner);
  if (!bookie) return false;

  const now = Date.now();
  await insertNeonDeskTransaction(
    {
      accountId: bookie.id,
      amount,
      category: "free_bet",
      note: `Free bet promo - ${reason} (${bet.label})`,
      betId: bet.id,
      createdAt: now,
    },
    owner
  );
  await insertNeonDeskHistory(
    {
      dedupe: `fb-promo:${bet.id}`,
      kind: "free_bet_promo",
      betId: bet.id,
      eventId: bet.eventId,
      title: FREE_BET_EARNED_PHRASE,
      detail: `£${amount.toFixed(2)} · ${reason}`,
      amount,
      createdAt: now,
    },
    owner
  );
  return true;
}

/**
 * Hosted equivalent of processAiEffects for unconditional / refund-if awards.
 * Place-conditional rewards still need the racing-result path.
 * Snapshot awards must not credit a promo until placement has debited
 * (or attempted to debit) the qualifying stake.
 */
export async function awardNeonUnconditionalFreeBetIfDue(
  bet: BetRow,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;
  if (bet.status === "open" || bet.status === "void") return false;
  if (bet.betType === "free_snr" || bet.betType === "free_sr") return false;

  for (const effect of freeBetEffectsForBet(bet)) {
    if (effect.kind !== "free_bet_award") continue;
    if (isPlaceFreeBetEffect(effect)) continue;
    const verdict = evaluateUnconditionalFreeBet(effect, bet.status);
    if (!verdict.met) continue;
    if (!bet.balanceLedgered) {
      const placed = await ledgerNeonBetPlacement(bet, owner);
      if (!placed) return false;
    }
    return ledgerNeonPromoAward(bet, effect.amount, verdict.reason, owner);
  }
  return false;
}

export async function awardNeonUnconditionalFreeBetsDue(
  bets: BetRow[],
  existingTxs: Array<{ betId: number | null; category: string | null; amount: number }>,
  clerkUserId = neonDeskClerkUserId()
): Promise<number> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return 0;
  const already = new Set(
    existingTxs
      .filter((t) => t.category === "free_bet" && t.betId != null && t.amount > 0)
      .map((t) => t.betId as number)
  );
  let n = 0;
  for (const bet of bets) {
    if (already.has(bet.id)) continue;
    if (await awardNeonUnconditionalFreeBetIfDue(bet, owner)) n += 1;
  }
  return n;
}

export async function purgeNeonDeskLedgerForBet(
  betId: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  await purgeNeonDeskTransactionsForBet(betId, clerkUserId);
}

/**
 * Re-sync placement rows after an open hosted bet is edited (stake, lay, bookie).
 */
export async function reledgerNeonOpenBetPlacement(
  next: BetRow,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return;
  if (next.status !== "open" || next.balanceSettled) return;
  if (next.betType === "dutch") return;
  await purgeNeonDeskPlacementTransactionsForBet(next.id, owner);
  await patchNeonDeskBet(next.id, { balanceLedgered: 0 }, owner);
  await ledgerNeonBetPlacement({ ...next, balanceLedgered: 0 }, owner);
}

/** Place-ledger open bets, and cash-settle rows that already have a result. */
export async function healNeonDeskLedgers(
  bets: BetRow[],
  clerkUserId = neonDeskClerkUserId()
): Promise<number> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return 0;
  let n = 0;
  for (const bet of bets) {
    try {
      if (bet.status === "open") {
        if (bet.balanceLedgered) continue;
        if (await ledgerNeonBetPlacement(bet, owner)) n += 1;
      } else if (!bet.balanceSettled) {
        if (await ledgerNeonBetSettlement(bet, owner)) n += 1;
      }
    } catch (error) {
      logNeonLedgerFailure("heal", bet.id, error);
    }
  }
  return n;
}

/** Place-ledger every open hosted bet that never got wallet rows. */
export async function healNeonOpenBetPlacements(
  bets: BetRow[],
  clerkUserId = neonDeskClerkUserId()
): Promise<number> {
  return healNeonDeskLedgers(
    bets.filter((b) => b.status === "open"),
    clerkUserId
  );
}
