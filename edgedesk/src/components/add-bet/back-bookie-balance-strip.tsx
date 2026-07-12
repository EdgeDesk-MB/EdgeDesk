"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { MoneyFlow } from "@/components/money-flow";
import type { BetMode } from "@/lib/calc";
import type { AccountBalance } from "@/lib/services/balances.types";
import { cn } from "@/lib/utils";

export function isFreeBetBetType(betType: BetMode): boolean {
  return betType === "free_snr" || betType === "free_sr";
}

export function findBookieBalanceAccount(
  accounts: AccountBalance[] | undefined,
  bookmaker: string
): AccountBalance | undefined {
  const q = bookmaker.trim().toLowerCase();
  if (!q) return undefined;
  return accounts?.find((a) => a.type === "bookie" && a.name.toLowerCase() === q);
}

/** Free-bet £ available for this bookie (any mode). */
export function bookieFreeBetBalance(
  accounts: AccountBalance[] | undefined,
  bookmaker: string
): number {
  const account = findBookieBalanceAccount(accounts, bookmaker);
  return account?.freeBets ?? 0;
}

/** True when cash stake needs funding (no wallet or balance below stake). */
export function bookieNeedsCashFunding(
  accounts: AccountBalance[] | undefined,
  bookmaker: string,
  backStake: number
): boolean {
  if (!bookmaker.trim()) return false;
  if (!(backStake > 0)) return false;
  const account = findBookieBalanceAccount(accounts, bookmaker);
  if (!account) return true;
  return account.balance + 0.001 < backStake;
}

/** Cash + free-bet balance for the selected bookie in Add bet / Back panel. */
export function BackBookieBalanceStrip({
  bookmaker,
  betType,
  backStake,
  accounts,
  addBalance,
  onAddBalanceChange,
  onUseFreeBet,
  className,
}: {
  bookmaker: string;
  betType: BetMode;
  backStake: number;
  accounts?: AccountBalance[];
  /** When set, show “Add balance” for cash bets that need funding */
  addBalance?: boolean;
  onAddBalanceChange?: (checked: boolean) => void;
  /** Switch to free-bet mode / fill stake from available FB */
  onUseFreeBet?: (amount: number) => void;
  className?: string;
}) {
  if (betType !== "qualifying" && betType !== "risk_free" && !isFreeBetBetType(betType)) {
    return null;
  }

  const account = findBookieBalanceAccount(accounts, bookmaker);
  const usesFreeBet = isFreeBetBetType(betType);
  const freeBets = account?.freeBets ?? 0;
  const cash = account?.balance ?? 0;
  const needsFunding =
    !usesFreeBet && bookieNeedsCashFunding(accounts, bookmaker, backStake);
  const showAddBalance = needsFunding && onAddBalanceChange != null;

  if (!bookmaker.trim()) {
    return (
      <p className={cn("text-[11px] font-medium text-black/45 dark:text-white/45", className)}>
        Select a bookie to see available balance.
      </p>
    );
  }

  if (!account && !showAddBalance) {
    return (
      <p className={cn("text-[11px] leading-snug text-black/55 dark:text-white/55", className)}>
        No balance tracked for {bookmaker}. Saving a bet will create the account.{" "}
        <Link href="/accounts" className="font-semibold text-primary underline-offset-2 hover:underline">
          Open Accounts
        </Link>
      </p>
    );
  }

  const stake = Number.isFinite(backStake) && backStake > 0 ? backStake : 0;
  const primaryAvailable = usesFreeBet ? freeBets : cash;
  const over =
    account != null &&
    stake > primaryAvailable + 0.001 &&
    !( !usesFreeBet && addBalance);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {/* Primary strip - cash or free bet depending on mode */}
      {account ? (
        <div
          className={cn(
            "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold",
            usesFreeBet
              ? "bg-violet-600/15 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100"
              : "bg-black/10 text-black/75 dark:bg-white/10 dark:text-white/80"
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {usesFreeBet && (
              <Gift className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
            )}
            {usesFreeBet ? "Free bet balance" : "Cash balance"}
          </span>
          <MoneyFlow
            value={primaryAvailable}
            className={cn(
              "shrink-0 tabular-nums",
              usesFreeBet && "text-violet-700 dark:text-violet-300"
            )}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-md bg-black/10 px-2.5 py-1.5 text-[11px] font-semibold text-black/75 dark:bg-white/10 dark:text-white/80">
          <span>Cash balance</span>
          <span className="tabular-nums text-muted-foreground">No wallet</span>
        </div>
      )}

      {/* Always surface free bets when in cash mode (and vice versa if useful) */}
      {account && !usesFreeBet && freeBets > 0.001 ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-violet-600/12 px-2.5 py-1.5 text-[11px] font-semibold text-violet-950 dark:bg-violet-500/15 dark:text-violet-100">
          <span className="flex min-w-0 items-center gap-1.5">
            <Gift className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
            Free bet balance
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <MoneyFlow value={freeBets} className="tabular-nums text-violet-700 dark:text-violet-300" />
            {onUseFreeBet ? (
              <button
                type="button"
                onClick={() => onUseFreeBet(freeBets)}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 underline-offset-2 hover:underline dark:text-violet-200"
              >
                Use
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      {account && usesFreeBet && cash !== 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-black/8 px-2.5 py-1 text-[10px] font-medium text-black/60 dark:bg-white/8 dark:text-white/60">
          <span>Cash balance</span>
          <MoneyFlow value={cash} className="tabular-nums" />
        </div>
      ) : null}

      {stake > 0 && account && (
        <p
          className={cn(
            "px-0.5 text-[10px] font-medium tabular-nums",
            over
              ? "text-amber-800 dark:text-amber-300"
              : usesFreeBet
                ? "text-violet-800/90 dark:text-violet-300/90"
                : "text-black/55 dark:text-white/55"
          )}
        >
          {usesFreeBet ? "Using" : "Stake"} £{stake.toFixed(2)}
          {primaryAvailable > 0 && (
            <>
              {" "}
              of £{primaryAvailable.toFixed(2)} available
            </>
          )}
          {over && " - exceeds available"}
        </p>
      )}
      {showAddBalance ? (
        <label className="flex cursor-pointer items-center gap-2 px-0.5 pt-0.5 text-[11px] font-semibold text-black/75 dark:text-white/80">
          <input
            type="checkbox"
            className="size-3.5 rounded border-border accent-primary"
            checked={addBalance === true}
            onChange={(e) => onAddBalanceChange?.(e.target.checked)}
          />
          Add balance
          {stake > 0 ? (
            <span className="font-medium text-black/50 dark:text-white/50">
              (£{stake.toFixed(2)})
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}
