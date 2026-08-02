"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { MoneyFlow } from "@/components/money-flow";
import type { BetMode } from "@/lib/calc";
import type { AccountBalance } from "@/lib/services/balances.types";
import { cn } from "@/lib/utils";

export type FreeBetKind = "snr" | "sr";

export function isFreeBetBetType(betType: BetMode | string): boolean {
  return betType === "free_snr" || betType === "free_sr";
}

/**
 * Bet types that may stake from tracked free-bet balance.
 * Qualifying and risk-free stay cash-only (Use there switches mode instead).
 */
export function betTypeCanStakeFreeBet(betType: string): boolean {
  return (
    betType === "free_snr" ||
    betType === "free_sr" ||
    betType === "no_lay" ||
    betType === "dutch"
  );
}

/** Stored `bets.betType` for a no-lay save with optional free-bet funding. */
export function noLaySaveBetType(freeBet: FreeBetKind | null): BetMode {
  if (freeBet === "sr") return "free_sr";
  if (freeBet === "snr") return "free_snr";
  return "qualifying";
}

/**
 * Unhedged free bets are saved as free_snr/free_sr with zero lay.
 * That shape can only come from No lay + free-bet funding (matched free bets
 * require a lay), so edit hydrates them back as no_lay + this kind.
 */
export function noLayFreeBetFromStored(
  betType: string,
  layStake: number,
  layOdds: number
): FreeBetKind | null {
  if (!(layStake === 0 && layOdds === 0)) return null;
  if (betType === "free_snr") return "snr";
  if (betType === "free_sr") return "sr";
  return null;
}

export function findBookieBalanceAccount(
  accounts: AccountBalance[] | undefined,
  bookmaker: string
): AccountBalance | undefined {
  const q = bookmaker.trim().toLowerCase();
  if (!q) return undefined;
  return accounts?.find((a) => a.type === "bookie" && a.name.toLowerCase() === q);
}

/** Stake already locked on an open ledgered bet being edited (same bookie). */
export type EditBetReservedSource = {
  status: string;
  balanceLedgered: number;
  betType: string;
  backStake: number;
  bookmaker: string | null;
};

/**
 * Cash or free-bet £ already reserved by the bet under edit. Counts as available
 * for funding checks so re-saving the same stake does not look underfunded.
 */
export function editBetReservedCredit(
  editBet: EditBetReservedSource | null | undefined,
  bookmaker: string,
  mode: "cash" | "free_bet"
): number {
  if (!editBet) return 0;
  if (editBet.status !== "open" || !editBet.balanceLedgered) return 0;
  if (!(editBet.backStake > 0)) return 0;
  const q = bookmaker.trim().toLowerCase();
  if (!q) return 0;
  if ((editBet.bookmaker ?? "").trim().toLowerCase() !== q) return 0;
  const wasFree = editBet.betType === "free_snr" || editBet.betType === "free_sr";
  if (mode === "free_bet") return wasFree ? editBet.backStake : 0;
  return wasFree ? 0 : editBet.backStake;
}

/** Free-bet £ available for this bookie (any mode). */
export function bookieFreeBetBalance(
  accounts: AccountBalance[] | undefined,
  bookmaker: string,
  reservedCredit = 0
): number {
  const account = findBookieBalanceAccount(accounts, bookmaker);
  return (account?.freeBets ?? 0) + Math.max(0, reservedCredit);
}

/** True when cash stake needs funding (no wallet or balance below stake). */
export function bookieNeedsCashFunding(
  accounts: AccountBalance[] | undefined,
  bookmaker: string,
  backStake: number,
  reservedCredit = 0
): boolean {
  if (!bookmaker.trim()) return false;
  if (!(backStake > 0)) return false;
  const account = findBookieBalanceAccount(accounts, bookmaker);
  const available = (account?.balance ?? 0) + Math.max(0, reservedCredit);
  if (!account && reservedCredit <= 0) return true;
  return available + 0.001 < backStake;
}

/** Extra top-up needed after wallet + any edit reserved credit. */
export function bookieCashTopUpNeeded(
  accounts: AccountBalance[] | undefined,
  bookmaker: string,
  backStake: number,
  reservedCredit = 0
): number {
  if (!bookmaker.trim() || !(backStake > 0)) return 0;
  const account = findBookieBalanceAccount(accounts, bookmaker);
  const available = (account?.balance ?? 0) + Math.max(0, reservedCredit);
  return Math.max(0, backStake - available);
}

/** Cash + free-bet balance for the selected bookie in Add bet / Back panel. */
export function BackBookieBalanceStrip({
  bookmaker,
  betType,
  backStake,
  accounts,
  reservedCredit = 0,
  /** True when staking from free-bet balance while UI bet type is not free_snr/free_sr (e.g. no_lay). */
  usingFreeBet = false,
  addBalance,
  onAddBalanceChange,
  onUseFreeBet,
  onUseCash,
  className,
}: {
  bookmaker: string;
  betType: BetMode;
  backStake: number;
  accounts?: AccountBalance[];
  /** Stake already locked by the open bet being edited (same bookie). */
  reservedCredit?: number;
  usingFreeBet?: boolean;
  /** When set, show “Add balance” for cash bets that need funding */
  addBalance?: boolean;
  onAddBalanceChange?: (checked: boolean) => void;
  /** Switch to free-bet funding / fill stake from available FB */
  onUseFreeBet?: (amount: number) => void;
  /** Leave free-bet funding and stake cash instead (no_lay overlay). */
  onUseCash?: () => void;
  className?: string;
}) {
  if (betType !== "qualifying" && betType !== "risk_free" && !isFreeBetBetType(betType)) {
    return null;
  }

  const account = findBookieBalanceAccount(accounts, bookmaker);
  const usesFreeBet = isFreeBetBetType(betType) || usingFreeBet;
  const credit = Math.max(0, reservedCredit);
  const freeBets = (account?.freeBets ?? 0) + (usesFreeBet ? credit : 0);
  const cash = account?.balance ?? 0;
  const cashAvailable = cash + (!usesFreeBet ? credit : 0);
  const needsFunding =
    !usesFreeBet && bookieNeedsCashFunding(accounts, bookmaker, backStake, credit);
  const showAddBalance = needsFunding && onAddBalanceChange != null;
  const topUpNeeded = bookieCashTopUpNeeded(accounts, bookmaker, backStake, credit);

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
  const walletPrimary = usesFreeBet ? (account?.freeBets ?? 0) : cash;
  const primaryAvailable = usesFreeBet ? freeBets : cashAvailable;
  const over =
    (account != null || credit > 0) &&
    stake > primaryAvailable + 0.001 &&
    !(!usesFreeBet && addBalance);

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
            value={walletPrimary}
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

      {account && usesFreeBet && (cash !== 0 || onUseCash) ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-black/8 px-2.5 py-1 text-[10px] font-medium text-black/60 dark:bg-white/8 dark:text-white/60">
          <span>Cash balance</span>
          <span className="flex shrink-0 items-center gap-2">
            <MoneyFlow value={cash} className="tabular-nums" />
            {onUseCash ? (
              <button
                type="button"
                onClick={onUseCash}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black/70 underline-offset-2 hover:underline dark:text-white/70"
              >
                Use cash
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      {stake > 0 && (account || credit > 0) && (
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
              {credit > 0.001 ? " (includes this bet)" : ""}
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
          {topUpNeeded > 0.001 ? (
            <span className="font-medium text-black/50 dark:text-white/50">
              (£{topUpNeeded.toFixed(2)})
            </span>
          ) : null}
        </label>
      ) : null}
    </div>
  );
}
