/**
 * Hosted cash ledger for bet place/settle, plus promo free-bet credits
 * (awardOnLoss / unconditional unlock). free_snr/free_sr debit a free_bet
 * usage row; lot FIFO is derived from those rows. Dutch free legs and WR
 * burn match the local balances helpers.
 */
import "server-only";

import { wrContributionForBet } from "@/lib/accounts/wagering";
import { freeBetUsageNote } from "@/lib/accounts/free-bet-lot-balance";
import type { DutchLegRecord } from "@/lib/calc/settlement";
import { ensureNeonVenueAccount } from "@/lib/db/neon-desk-ensure-venue";
import {
  deleteNeonDeskFreeBetUsageForBet,
  insertNeonDeskTransaction,
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
  listNeonExchanges,
  patchNeonDeskAccount,
  purgeNeonDeskPlacementTransactionsForBet,
  purgeNeonDeskSettlementTransactionsForBet,
  purgeNeonDeskTransactionsForBet,
} from "@/lib/db/neon-desk-accounts";
import {
  claimNeonBetPlacementLedger,
  claimNeonBetSettlementLedger,
  neonDeskClerkUserId,
  patchNeonDeskBet,
} from "@/lib/db/neon-desk";
import { insertNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { evaluateUnconditionalFreeBet, isPlaceFreeBetEffect } from "@/lib/calc/ai-triggers";
import {
  EARLY_FREE_BET_AWARD_REASON,
  FREE_BET_EARNED_PHRASE,
  freeBetEffectsForBet,
  unconditionalFreeBetEffect,
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

function parseDutchLegs(bet: BetRow): DutchLegRecord[] {
  if (!bet.legs) return [];
  try {
    const parsed = JSON.parse(bet.legs) as DutchLegRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function ledgerNeonFreeBetUsageDebit(
  accountId: number,
  stake: number,
  label: string,
  betId: number,
  owner: string
): Promise<void> {
  await insertNeonDeskTransaction(
    {
      accountId,
      amount: -stake,
      category: "free_bet",
      note: freeBetUsageNote(label, null),
      betId,
      createdAt: Date.now(),
    },
    owner
  );
}

async function applyNeonWageringRequirement(
  bet: BetRow,
  bookie: AccountRow,
  owner: string
): Promise<void> {
  const burn = wrContributionForBet(bet, bookie);
  if (!(burn > 0)) return;
  const next = Math.max(0, Math.round((bookie.wrRemaining - burn) * 100) / 100);
  await patchNeonDeskAccount(bookie.id, { wrRemaining: next }, owner);
  bookie.wrRemaining = next;
}

async function ledgerNeonDutchFreeLegs(bet: BetRow, owner: string): Promise<void> {
  for (const leg of parseDutchLegs(bet)) {
    if (!leg.freeBet || !leg.bookmaker?.trim() || !(leg.stake > 0)) continue;
    const { account } = await ensureNeonVenueAccount(leg.bookmaker, "bookie", owner);
    await ledgerNeonFreeBetUsageDebit(
      account.id,
      leg.stake,
      `${bet.label} (${leg.label})`,
      bet.id,
      owner
    );
  }
}

/** Debit back stake, free-bet usage, WR, and lay liability when a hosted bet is saved. */
export async function ledgerNeonBetPlacement(
  bet: BetRow,
  clerkUserId = neonDeskClerkUserId(),
  opts?: { applyWagering?: boolean }
): Promise<boolean> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;
  // Idempotent: already written, or another worker holds the claim.
  if (bet.balanceLedgered) return true;
  const applyWagering = opts?.applyWagering !== false;

  if (bet.betType === "dutch") {
    const claimed = await claimNeonBetPlacementLedger(bet.id, owner);
    if (!claimed) return true;
    try {
      await ledgerNeonDutchFreeLegs(bet, owner);
      return true;
    } catch (error) {
      await purgeNeonDeskPlacementTransactionsForBet(bet.id, owner);
      await patchNeonDeskBet(bet.id, { balanceLedgered: 0 }, owner);
      throw error;
    }
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

    if (bookie && bet.backStake > 0 && isFree) {
      await ledgerNeonFreeBetUsageDebit(bookie.id, bet.backStake, bet.label, bet.id, owner);
    }
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
      if (applyWagering) await applyNeonWageringRequirement(bet, bookie, owner);
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
    await claimNeonBetSettlementLedger(bet.id, owner);
    return true;
  }

  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const bookie = await neonBookieForBet(bet, owner);
  const exchange = await neonExchangeForBet(bet, owner);
  if (!bookie && !exchange) return false;

  const claimed = await claimNeonBetSettlementLedger(bet.id, owner);
  // Lost the race: the winner writes (or has written) the payout rows.
  if (!claimed) return true;

  const liability = bet.layStake * (bet.layOdds - 1);
  const layWinnings = bet.layStake * (1 - bet.commission);
  const now = Date.now();

  try {
    if (bet.status === "void" || bet.status === "push") {
      if (bookie && bet.backStake > 0 && isFree) {
        await deleteNeonDeskFreeBetUsageForBet(bet.id, owner);
      } else if (bookie && bet.backStake > 0 && !isFree) {
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

    return true;
  } catch (error) {
    await purgeNeonDeskSettlementTransactionsForBet(bet.id, owner);
    await patchNeonDeskBet(bet.id, { balanceSettled: 0 }, owner);
    throw error;
  }
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

/**
 * Manual early credit (bookie released the free bet on placement).
 * Same gates as awardUnconditionalFreeBetEarly; wallets via Neon ledger.
 */
export async function awardNeonUnconditionalFreeBetEarly(
  bet: BetRow,
  offerTitle?: string | null,
  clerkUserId = neonDeskClerkUserId()
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return { ok: false, error: "Sign in to award a free bet" };
  if (bet.status === "void") {
    return { ok: false, error: "Void bets cannot award a free bet" };
  }
  if (bet.betType === "free_snr" || bet.betType === "free_sr") {
    return { ok: false, error: "Conversion bets cannot award a free bet" };
  }
  const effect = unconditionalFreeBetEffect(bet, offerTitle);
  if (!effect) {
    return { ok: false, error: "Bet has no unconditional free-bet reward" };
  }
  if (!bet.bookmaker?.trim()) {
    return { ok: false, error: "Bookmaker is required to credit the free bet" };
  }
  if (!bet.balanceLedgered) {
    const placed = await ledgerNeonBetPlacement(bet, owner);
    if (!placed) {
      return { ok: false, error: "Could not reserve the qualifying stake" };
    }
  }
  const credited = await ledgerNeonPromoAward(
    bet,
    effect.amount,
    EARLY_FREE_BET_AWARD_REASON,
    owner
  );
  if (!credited) {
    return { ok: false, error: "Free bet already credited for this bet" };
  }
  return { ok: true, amount: effect.amount };
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
  await purgeNeonDeskPlacementTransactionsForBet(next.id, owner);
  await patchNeonDeskBet(next.id, { balanceLedgered: 0 }, owner);
  await ledgerNeonBetPlacement({ ...next, balanceLedgered: 0 }, owner, {
    applyWagering: false,
  });
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
