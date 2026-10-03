"use client";

import Link from "next/link";
import { MoneyFlow } from "@/components/money-flow";
import { ADD_BET_BALANCE_WELL } from "@/components/add-bet/back-bookie-balance-strip";
import { findVenueBalanceAccount } from "@/lib/accounts/resolve-venue";
import {
  layFundingNeed,
  openLedgeredLays,
  type LayFundingNeed,
  type SharedLiabilityBet,
  type SharedLiabilityLay,
} from "@/lib/calc/shared-liability";
import { formatGbp } from "@/lib/format-money";
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

/**
 * Lays the selected exchange wallet is already holding. The desk balance is
 * `free cash - reserve(these lays)`, so they are what the candidate lay has
 * to be priced against.
 *
 * Bets are matched on `exchangeId`, while the server ledger keys off the
 * `bet_stake` rows it wrote. The two only diverge for a bet ledgered to a
 * wallet its `exchangeId` does not point at, which the desk does not create.
 */
export function openLaysOnExchange(
  bets: Array<SharedLiabilityBet & { exchangeId: number | null }> | undefined,
  exchangeId: number | null | undefined
): SharedLiabilityLay[] {
  if (exchangeId == null) return [];
  return openLedgeredLays((bets ?? []).filter((b) => b.exchangeId === exchangeId));
}

export interface ExchangeFundingNeed extends LayFundingNeed {
  /** Cash the wallet is short of. Drives "Exceeds balance". */
  needsFunding: boolean;
}

/**
 * Whether the selected exchange can fund this lay.
 *
 * Compares the **rise in reserve** against the wallet, not the lay's own
 * liability: lays covering other results of the same single-winner market
 * already hold cash this one can use, because only one result can win. An
 * existing lay on the bet being edited is replaced rather than counted
 * twice, which is what `candidate.id` carrying the edited bet's id does.
 */
export function exchangeFundingNeed(
  accounts: AccountBalance[] | undefined,
  exchangeId: number | null | undefined,
  exchangeName: string,
  candidate: SharedLiabilityLay,
  openLays: SharedLiabilityLay[] = []
): ExchangeFundingNeed {
  const need = layFundingNeed(openLays, candidate);
  if (need.grossLiability <= 0 || (exchangeId == null && !exchangeName.trim())) {
    return { ...need, needsFunding: false };
  }
  const account = findExchangeBalanceAccount(accounts, exchangeId, exchangeName);
  if (!account) return { ...need, needsFunding: need.cashRequired > 0 };
  return {
    ...need,
    needsFunding: account.balance + 0.001 < need.cashRequired,
  };
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

/**
 * Shared liability is covering part of this lay. Same shape as
 * {@link ExchangeBalanceIssue}, on `--success` rather than `--warning`:
 * nothing is wrong, the wallet simply needs less than the liability.
 */
export function ExchangeSharedLiabilityNote({
  cashRequired,
  grossLiability,
  className,
}: {
  cashRequired: number;
  grossLiability: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5 px-0.5 pt-0.5", className)}>
      <p className="text-xs font-medium text-success">Shared liability</p>
      <p className="text-xs leading-snug text-black/55 dark:text-white/65">
        Your other lays on this market cover a result this one cannot, so only{" "}
        {formatGbp(cashRequired)} of the {formatGbp(grossLiability)} liability
        is locked.
      </p>
    </div>
  );
}
