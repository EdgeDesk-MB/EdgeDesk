"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { MoneyFlow } from "@/components/money-flow";
import type { BetMode } from "@/lib/calc";
import type { AccountBalance } from "@/lib/services/balances";
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

/** Cash vs free-bet balance for the selected bookie in Add bet / Back panel. */
export function BackBookieBalanceStrip({
  bookmaker,
  betType,
  backStake,
  accounts,
  className,
}: {
  bookmaker: string;
  betType: BetMode;
  backStake: number;
  accounts?: AccountBalance[];
  className?: string;
}) {
  if (betType !== "qualifying" && betType !== "risk_free" && !isFreeBetBetType(betType)) {
    return null;
  }

  const account = findBookieBalanceAccount(accounts, bookmaker);
  const usesFreeBet = isFreeBetBetType(betType);

  if (!bookmaker.trim()) {
    return (
      <p className={cn("text-[11px] font-medium text-black/45 dark:text-white/45", className)}>
        Select a bookie to see available balance.
      </p>
    );
  }

  if (!account) {
    return (
      <p className={cn("text-[11px] leading-snug text-black/55 dark:text-white/55", className)}>
        No balance tracked for {bookmaker}.{" "}
        <Link href="/balances" className="font-semibold text-primary underline-offset-2 hover:underline">
          Add in Balances
        </Link>
      </p>
    );
  }

  const available = usesFreeBet ? account.freeBets ?? 0 : account.balance;
  const stake = Number.isFinite(backStake) && backStake > 0 ? backStake : 0;
  const over = stake > available + 0.001;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold",
          usesFreeBet
            ? "bg-violet-600/15 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100"
            : "bg-black/10 text-black/75 dark:bg-white/10 dark:text-white/80"
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {usesFreeBet && <Gift className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />}
          {usesFreeBet ? "Free bet balance" : "Cash balance"}
        </span>
        <MoneyFlow
          value={available}
          className={cn(
            "shrink-0 tabular-nums",
            usesFreeBet && "text-violet-700 dark:text-violet-300"
          )}
        />
      </div>
      {stake > 0 && (
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
          {available > 0 && (
            <>
              {" "}
              of £{available.toFixed(2)} available
            </>
          )}
          {over && " — exceeds available"}
        </p>
      )}
    </div>
  );
}
