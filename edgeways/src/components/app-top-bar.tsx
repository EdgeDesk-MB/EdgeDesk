"use client";

import Link from "next/link";
import { UserCircle } from "lucide-react";
import { EdgewaysLogo } from "@/components/edgeways-logo-icon";
import { AppTopBarMenu } from "@/components/app-top-bar-menu";
import { MoneyFlow } from "@/components/money-flow";
import { useFreeBets } from "@/components/accounts/free-bets-convert-dialog";
import { useMemo } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { accountOwner } from "@/lib/accounts/owners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  appNavColumn,
  appNavInset,
  appShellGap,
  appShellMaxWidth,
  appShellPadding,
} from "@/lib/ui/app-shell-layout";
import { cn } from "@/lib/utils";

function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Edgeways home"
      className={cn(
        "flex shrink-0 items-center transition-opacity hover:opacity-90",
        appNavInset,
        className
      )}
    >
      <EdgewaysLogo />
    </Link>
  );
}

/** Profit on the yellow top bar: green when ≥ 0, red when negative. */
function profitToneClass(value: number): string {
  return value < -0.004 ? "text-red-700" : "text-emerald-700";
}

const stackShell =
  "flex min-h-8 flex-col items-end justify-center gap-0 border-b border-transparent px-1 py-0.5 text-[11px] transition-colors hover:border-b-[#111111]";

function StackRow({
  label,
  value,
  amountClass,
}: {
  label: string;
  value: number;
  amountClass?: string;
}) {
  return (
    <span className="flex items-baseline justify-end gap-0.5 leading-none">
      <span className="text-topbar-muted">{label}</span>
      <MoneyFlow
        value={value}
        className={cn("font-bold tabular-nums text-topbar-foreground", amountClass)}
      />
    </span>
  );
}

/** Profit above Free bets. Profit alone centres vertically when free bets are hidden. */
function TopBarProfitStack({
  profit,
  freeBets,
  showFreeBets,
  onFreeBets,
}: {
  profit: number;
  freeBets: number;
  showFreeBets: boolean;
  onFreeBets: () => void;
}) {
  return (
    <div className={stackShell}>
      <Link
        href="/tracker?tab=pnl"
        className="rounded-sm leading-none transition-opacity hover:opacity-80"
        aria-label={`Profit ${profit.toFixed(2)}`}
      >
        <StackRow label="Profit" value={profit} amountClass={profitToneClass(profit)} />
      </Link>
      {showFreeBets ? (
        <button
          type="button"
          onClick={onFreeBets}
          className="rounded-sm text-right leading-none transition-opacity hover:opacity-80"
          aria-label={`Free bets ${freeBets.toFixed(2)}`}
        >
          <StackRow label="Free bets" value={freeBets} amountClass="text-violet-700" />
        </button>
      ) : null}
    </div>
  );
}

/** Total above Exchange. Total alone centres vertically when exchange is hidden. */
function TopBarBankrollStack({
  exchange,
  inBets,
  total,
  showExchange,
  ownerLines,
}: {
  exchange: number;
  inBets: number;
  total: number;
  showExchange: boolean;
  ownerLines: Array<{ owner: string; balance: number }>;
}) {
  const showInBets = inBets > 0.005;
  const chip = (
    <Link
      href="/accounts"
      className={stackShell}
      aria-label={
        showExchange
          ? showInBets
            ? `Bankroll: total ${total.toFixed(2)}, exchange ${exchange.toFixed(2)}, in-bets ${inBets.toFixed(2)}`
            : `Bankroll: total ${total.toFixed(2)}, exchange ${exchange.toFixed(2)}`
          : `Bankroll total ${total.toFixed(2)}`
      }
    >
      <StackRow label="Total" value={total} />
      {showExchange ? <StackRow label="Exchange" value={exchange} /> : null}
      {showInBets ? <StackRow label="In-bets" value={inBets} /> : null}
    </Link>
  );

  if (ownerLines.length <= 1) return chip;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="mb-1 font-semibold">Bookie balances by owner</p>
          {ownerLines.map((l) => (
            <p key={l.owner} className="tabular-nums">
              {l.owner === "me" ? "Me" : l.owner}: £{l.balance.toFixed(2)}
            </p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Compact mobile: same stack order, tighter. */
function MobileStatStacks({
  profit,
  freeBets,
  showFreeBets,
  onFreeBets,
  total,
  exchange,
  showExchange,
}: {
  profit: number;
  freeBets: number;
  showFreeBets: boolean;
  onFreeBets: () => void;
  total: number;
  exchange: number;
  showExchange: boolean;
}) {
  return (
    <div className="flex items-center gap-2 sm:hidden">
      <div className={stackShell}>
        <Link href="/tracker?tab=pnl" aria-label={`Profit ${profit.toFixed(2)}`}>
          <StackRow label="Profit" value={profit} amountClass={profitToneClass(profit)} />
        </Link>
        {showFreeBets ? (
          <button type="button" onClick={onFreeBets} aria-label={`Free bets ${freeBets.toFixed(2)}`}>
            <StackRow label="Free bets" value={freeBets} amountClass="text-violet-700" />
          </button>
        ) : null}
      </div>
      <Link
        href="/accounts"
        className={stackShell}
        aria-label={`Bankroll total ${total.toFixed(2)}`}
      >
        <StackRow label="Total" value={total} />
        {showExchange ? <StackRow label="Exchange" value={exchange} /> : null}
      </Link>
    </div>
  );
}

export function AppTopBar() {
  const { state } = useAppState(5000);
  const { openFreeBets } = useFreeBets();
  const balances = state?.balances;
  const exchange = balances?.exchanges ?? 0;
  const inBets = balances?.inBets ?? 0;
  const bankroll = balances?.bankroll ?? balances?.total ?? 0;
  const ownerBalances = useMemo(() => {
    const rows = new Map<string, number>();
    for (const a of balances?.accounts ?? []) {
      if (a.type !== "bookie") continue;
      const owner = accountOwner(a);
      rows.set(owner, (rows.get(owner) ?? 0) + (a.balance ?? 0));
    }
    return [...rows.entries()]
      .map(([owner, balance]) => ({ owner, balance }))
      .sort((a, b) => (a.owner === "me" ? -1 : b.owner === "me" ? 1 : a.owner.localeCompare(b.owner)));
  }, [balances?.accounts]);
  const profit = (state?.settledProfit ?? 0) + (state?.provisionalProfit ?? 0);
  const freeBetsTotal =
    balances?.accounts
      ?.filter((a) => a.type === "bookie")
      .reduce((s, a) => s + (a.freeBets ?? 0), 0) ?? 0;
  const showFreeBets = freeBetsTotal > 0.005;
  const showExchange = exchange > 0.005;

  return (
    <header className="relative z-[45] shrink-0 border-b border-topbar-border bg-topbar text-topbar-foreground">
      <div
        className={cn(
          "flex h-14 w-full items-center",
          appShellGap,
          appShellPadding,
          appShellMaxWidth
        )}
      >
        <BrandLink className="md:hidden" />
        <div className={cn("hidden md:block", appNavColumn)}>
          <BrandLink />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-1.5">
          {state == null ? null : (
            <>
              {state.demoMode ? (
                <span className="shrink-0 rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                  Demo data
                </span>
              ) : null}
              <div className="hidden items-center gap-2 sm:flex">
                <TopBarProfitStack
                  profit={profit}
                  freeBets={freeBetsTotal}
                  showFreeBets={showFreeBets}
                  onFreeBets={openFreeBets}
                />
                <TopBarBankrollStack
                  exchange={exchange}
                  inBets={inBets}
                  total={bankroll}
                  showExchange={showExchange}
                  ownerLines={ownerBalances}
                />
              </div>
              <MobileStatStacks
                profit={profit}
                freeBets={freeBetsTotal}
                showFreeBets={showFreeBets}
                onFreeBets={openFreeBets}
                total={bankroll}
                exchange={exchange}
                showExchange={showExchange}
              />
            </>
          )}

          <div className="ml-3 flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#111111] px-2.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-[#111111]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]/40"
              aria-label="Sign in - coming soon"
            >
              <UserCircle className="size-4 shrink-0" strokeWidth={2} />
              <span className="hidden sm:inline">Login</span>
            </button>

            <AppTopBarMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
