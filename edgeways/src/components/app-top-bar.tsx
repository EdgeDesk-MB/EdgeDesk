"use client";

import Link from "next/link";
import { EdgewaysLogo } from "@/components/edgeways-logo-icon";
import { AppTopBarMenu } from "@/components/app-top-bar-menu";
import { AppTopBarMetaNav } from "@/components/app-top-bar-meta-nav";
import { ChromeTab } from "@/components/chrome-tab";
import { MoneyFlow } from "@/components/money-flow";
import { TopBarLoginButton } from "@/components/top-bar-login-button";
import { useFreeBets } from "@/components/accounts/free-bets-convert-dialog";
import { useMemo, type ReactNode } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { accountOwner } from "@/lib/accounts/owners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  appNavColumn,
  appNavInset,
  appShellGap,
  appShellMaxWidth,
} from "@/lib/ui/app-shell-layout";
import { cn } from "@/lib/utils";

function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Edgeways home"
      className={cn(
        "flex shrink-0 items-center transition-opacity sm:hover:opacity-90",
        appNavInset,
        className
      )}
    >
      <EdgewaysLogo topbar />
    </Link>
  );
}

/** Profit on the balance pill: green when ≥ 0, red when negative. */
function profitToneClass(value: number): string {
  return value < -0.004
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";
}

/** Single metric column inside the canvas balance pill. */
const stackShell =
  "flex min-h-0 flex-col items-end justify-center gap-0.5 px-1.5 text-[12px] sm:text-[11px]";

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
    <span className="flex items-baseline justify-end gap-1 leading-none">
      <span className="text-muted-foreground">{label}</span>
      <MoneyFlow
        value={value}
        className={cn("font-bold tabular-nums text-foreground", amountClass)}
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
        className="rounded-sm leading-none transition-opacity sm:hover:opacity-80"
        aria-label={`Profit ${profit.toFixed(2)}`}
      >
        <StackRow label="Profit" value={profit} amountClass={profitToneClass(profit)} />
      </Link>
      {showFreeBets ? (
        <button
          type="button"
          onClick={onFreeBets}
          className="rounded-sm text-right leading-none transition-opacity sm:hover:opacity-80"
          aria-label={`Free bets ${freeBets.toFixed(2)}`}
        >
          <StackRow
            label="Free bets"
            value={freeBets}
            amountClass="text-violet-600 dark:text-violet-400"
          />
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
  // Exchange and In-bets share the second row — In-bets wins when present.
  const showExchangeRow = showExchange && !showInBets;
  const chip = (
    <Link
      href="/accounts"
      className={stackShell}
      aria-label={
        showInBets
          ? `Bankroll: total ${total.toFixed(2)}, in-bets ${inBets.toFixed(2)}`
          : showExchangeRow
            ? `Bankroll: total ${total.toFixed(2)}, exchange ${exchange.toFixed(2)}`
            : `Bankroll total ${total.toFixed(2)}`
      }
    >
      <StackRow label="Total" value={total} />
      {showExchangeRow ? <StackRow label="Exchange" value={exchange} /> : null}
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

/** Compact mobile stacks inside the shared Chrome balance tab. */
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
    <>
      <div className={stackShell}>
        <Link href="/tracker?tab=pnl" aria-label={`Profit ${profit.toFixed(2)}`}>
          <StackRow
            label="Profit"
            value={profit}
            amountClass={profitToneClass(profit)}
          />
        </Link>
        {showFreeBets ? (
          <button type="button" onClick={onFreeBets} aria-label={`Free bets ${freeBets.toFixed(2)}`}>
            <StackRow
              label="Free bets"
              value={freeBets}
              amountClass="text-violet-600 dark:text-violet-400"
            />
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
    </>
  );
}

/**
 * Inverted Chrome tab: canvas plate hanging from the top of the header,
 * bottom radii + top ears blending into the topbar. Desktop: rightmost,
 * after Login. Mobile: flush with the burger.
 */
function BalancePill({ children }: { children: ReactNode }) {
  return (
    <ChromeTab
      edge="hang"
      className="flex items-stretch self-stretch overflow-visible px-2.5 text-foreground"
    >
      <div className="flex items-center gap-1">{children}</div>
    </ChromeTab>
  );
}

/** Logo, bankroll stacks, Login — ink chrome under the yellow top stripe. */
function AppTopBarHeader() {
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
    <div
      className={cn(
        // Stretch row: balance pill hangs from the top; Login sits on the bottom edge
        "flex min-h-14 w-full items-stretch overflow-visible",
        appShellGap,
        "px-0 pb-1 sm:px-[var(--layout-page-x)]",
        appShellMaxWidth
      )}
    >
      <BrandLink className="self-center md:hidden" />
      <div className={cn("hidden self-center md:block", appNavColumn)}>
        <BrandLink />
      </div>

      <div className="flex min-w-0 flex-1 items-stretch justify-end gap-1 sm:gap-1.5">
        {state?.demoMode ? (
          <span className="self-center shrink-0 rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-warning sm:text-[10px]">
            Demo data
          </span>
        ) : null}

        {/* Desktop: Login left of the balance tab (mobile Login is in the drawer). */}
        <div className="mr-3 hidden shrink-0 items-end md:flex">
          <TopBarLoginButton className="mb-0.5" />
        </div>

        {state == null ? null : (
          <>
            <div className="hidden items-stretch overflow-visible px-[var(--chrome-tab-r-hang)] sm:flex">
              <BalancePill>
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
              </BalancePill>
            </div>
            <div className="flex items-stretch overflow-visible px-[var(--chrome-tab-r-hang)] sm:hidden">
              <BalancePill>
                <MobileStatStacks
                  profit={profit}
                  freeBets={freeBetsTotal}
                  showFreeBets={showFreeBets}
                  onFreeBets={openFreeBets}
                  total={bankroll}
                  exchange={exchange}
                  showExchange={showExchange}
                />
              </BalancePill>
            </div>
          </>
        )}

        <div className="ml-3 flex shrink-0 items-center md:hidden">
          <div className="mr-3 self-center">
            <AppTopBarMenu />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppTopBar() {
  return (
    // Outer plate is always ink. Dia (and similar) extend the *page* colour into
    // the tab UI by sampling the top element’s background — if <header> itself
    // is yellow, the browser chrome goes yellow. Yellow lives on the inner shell.
    <header className="relative z-[45] shrink-0 overflow-visible bg-[#111111] text-topbar-foreground md:border-b-0">
      <div className="bg-topbar">
        {/* Dia samples this top band for tab tint — keep ink (dark) / highlight (light mobile). */}
        <div
          className="h-[var(--topbar-stripe-h)] w-full bg-highlight dark:bg-topbar-stripe md:bg-topbar-stripe"
          aria-hidden
        />
        <AppTopBarHeader />
        <AppTopBarMetaNav />
      </div>
    </header>
  );
}
