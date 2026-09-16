"use client";

import Link from "next/link";
import { MoneyFlow } from "@/components/money-flow";
import { ADD_BET_BALANCE_WELL } from "@/components/add-bet/back-bookie-balance-strip";
import { findVenueBalanceAccount } from "@/lib/accounts/resolve-venue";
import type { AccountBalance } from "@/lib/services/balances.types";
import { cn } from "@/lib/utils";

export function findExchangeBalanceAccount(
  accounts: AccountBalance[] | undefined,
  exchangeId: number | null | undefined,
  exchangeName: string
): AccountBalance | undefined {
  const active = (accounts ?? []).filter(
    (a) => a.type === "exchange" && a.isActive !== 0
  );
  if (exchangeId != null) {
    const byId = active.find((a) => a.exchangeId === exchangeId);
    if (byId) return byId;
  }
  return findVenueBalanceAccount(accounts, exchangeName);
}

/** Liability already locked on an open ledgered bet being edited (same exchange). */
export function editBetReservedLiability(
  editBet:
    | {
        status: string;
        balanceLedgered: number;
        exchangeId?: number | null;
        layStake: number;
        layOdds: number;
      }
    | null
    | undefined,
  exchangeId: number | null | undefined
): number {
  if (!editBet || exchangeId == null) return 0;
  if (editBet.status !== "open" || !editBet.balanceLedgered) return 0;
  if (editBet.exchangeId !== exchangeId) return 0;
  if (!(editBet.layStake > 0 && editBet.layOdds > 1)) return 0;
  return editBet.layStake * (editBet.layOdds - 1);
}

export function exchangeNeedsFunding(
  accounts: AccountBalance[] | undefined,
  exchangeId: number | null | undefined,
  exchangeName: string,
  liability: number,
  reservedCredit = 0
): boolean {
  if (!(liability > 0)) return false;
  if (exchangeId == null && !exchangeName.trim()) return false;
  const account = findExchangeBalanceAccount(accounts, exchangeId, exchangeName);
  const available = (account?.balance ?? 0) + Math.max(0, reservedCredit);
  if (!account && reservedCredit <= 0) return true;
  return available + 0.001 < liability;
}

export function ExchangeBalanceWell({
  exchangeName,
  exchangeId,
  accounts,
  className,
}: {
  exchangeName: string;
  exchangeId?: number | null;
  accounts?: AccountBalance[];
  className?: string;
}) {
  if (!exchangeName.trim()) {
    return (
      <p className={cn("text-xs font-medium text-black/45 dark:text-white/45", className)}>
        Select an exchange to see available balance.
      </p>
    );
  }

  const account = findExchangeBalanceAccount(accounts, exchangeId, exchangeName);
  if (!account) {
    return (
      <p className={cn("text-xs leading-snug text-black/55 dark:text-white/55", className)}>
        No balance tracked for {exchangeName}. Saving a bet will create the
        account.{" "}
        <Link
          href="/accounts"
          className="font-semibold text-primary-text underline-offset-2 hover:underline"
        >
          Open Accounts
        </Link>
      </p>
    );
  }

  return (
    <div className={cn(ADD_BET_BALANCE_WELL, className)}>
      <span>Balance</span>
      <MoneyFlow value={account.balance} className="shrink-0 tabular-nums" />
    </div>
  );
}

export function ExchangeBalanceIssue({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 px-0.5 pt-0.5", className)}>
      <p className="text-xs font-medium text-warning">Exceeds balance</p>
      <p className="text-xs leading-snug text-black/55 dark:text-white/65">
        Top up your exchange to fund this bet.
      </p>
    </div>
  );
}
