/**
 * Hosted cash ledger for bet place/settle. Free-bet lots and wagering
 * stay SQLite-only until their own cutover, so free_snr/free_sr skip the
 * lot drawdown here (cash stakes still debit).
 */
import "server-only";

import { ensureNeonVenueAccount } from "@/lib/db/neon-desk-ensure-venue";
import {
  insertNeonDeskTransaction,
  listNeonDeskAccounts,
  listNeonExchanges,
  purgeNeonDeskTransactionsForBet,
} from "@/lib/db/neon-desk-accounts";
import { neonDeskClerkUserId, patchNeonDeskBet } from "@/lib/db/neon-desk";
import type { AccountRow, BetRow } from "@/lib/db/schema";

function resolveOwner(clerkUserId?: string | null): string | null {
  return clerkUserId?.trim() || neonDeskClerkUserId();
}

async function neonBookieForBet(
  bet: BetRow,
  clerkUserId: string,
  createIfMissing: boolean
): Promise<AccountRow | undefined> {
  if (!bet.bookmaker?.trim()) return undefined;
  if (createIfMissing && clerkUserId === neonDeskClerkUserId()) {
    const { account } = await ensureNeonVenueAccount(bet.bookmaker, "bookie");
    return account;
  }
  const accounts = await listNeonDeskAccounts(clerkUserId);
  const q = bet.bookmaker.trim().toLowerCase();
  return accounts.find(
    (a) => a.type === "bookie" && a.isActive === 1 && a.name.toLowerCase() === q
  );
}

async function neonExchangeForBet(
  bet: BetRow,
  clerkUserId: string,
  createIfMissing: boolean
): Promise<AccountRow | undefined> {
  if (bet.exchangeId == null) return undefined;
  const accounts = await listNeonDeskAccounts(clerkUserId);
  const existing = accounts.find(
    (a) => a.type === "exchange" && a.exchangeId === bet.exchangeId && a.isActive === 1
  );
  if (existing) return existing;
  if (!createIfMissing || clerkUserId !== neonDeskClerkUserId()) return undefined;
  const exchanges = await listNeonExchanges();
  const ex = exchanges.find((e) => e.id === bet.exchangeId);
  if (!ex) return undefined;
  const { account } = await ensureNeonVenueAccount(ex.name, "exchange");
  return account;
}

/** Debit back stake and lay liability when a hosted bet is saved. */
export async function ledgerNeonBetPlacement(
  bet: BetRow,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;
  if (bet.balanceLedgered) return false;
  if (bet.betType === "dutch") {
    await patchNeonDeskBet(bet.id, { balanceLedgered: 1 }, owner);
    return true;
  }

  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const bookie = await neonBookieForBet(bet, owner, true);
  const exchange = await neonExchangeForBet(bet, owner, true);
  if (!bookie && !exchange) return false;

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

  await patchNeonDeskBet(bet.id, { balanceLedgered: 1 }, owner);
  return true;
}

/** Credit settlement payouts. Assumes cash stake debits were recorded at placement. */
export async function ledgerNeonBetSettlement(
  bet: BetRow,
  clerkUserId = neonDeskClerkUserId()
): Promise<boolean> {
  const owner = resolveOwner(clerkUserId);
  if (!owner) return false;
  if (bet.balanceSettled || !bet.balanceLedgered) return false;
  if (bet.betType === "dutch") {
    await patchNeonDeskBet(bet.id, { balanceSettled: 1 }, owner);
    return true;
  }

  const isFree = bet.betType === "free_snr" || bet.betType === "free_sr";
  const bookie = await neonBookieForBet(bet, owner, false);
  const exchange = await neonExchangeForBet(bet, owner, false);
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

export async function purgeNeonDeskLedgerForBet(
  betId: number,
  clerkUserId = neonDeskClerkUserId()
): Promise<void> {
  await purgeNeonDeskTransactionsForBet(betId, clerkUserId);
}
