"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EdgewaysBolt, EdgewaysLogo } from "@/components/edgeways-logo-icon";
import {
  balancesSheetAriaLabel,
  bankrollAriaLabel,
  bankrollCompanion,
} from "@/components/app-top-bar-bankroll";
import { AppTopBarMenu } from "@/components/app-top-bar-menu";
import { AppTopBarMetaNav } from "@/components/app-top-bar-meta-nav";
import { ChromeTab } from "@/components/chrome-tab";
import { MoneyFlow, moneyPositiveClass } from "@/components/money-flow";
import { isNegativeGbp } from "@/lib/format-money";
import { useFreeBets } from "@/components/accounts/free-bets-convert-dialog";
import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { accountOwner } from "@/lib/accounts/owners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  appNavColumn,
  appNavInset,
  appShellGap,
  appShellMaxWidth,
} from "@/lib/ui/app-shell-layout";
import { demoDataTag } from "@/lib/ui/surface-styles";
import { COLLAPSE_EASE, SPRING_DURATION_MS, SPRING_EASE } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

const BALANCE_PILL_COLLAPSED_KEY = "edgeways.balancePillCollapsed";

const balancePillListeners = new Set<() => void>();

function subscribeBalancePillCollapsed(listener: () => void): () => void {
  balancePillListeners.add(listener);
  return () => {
    balancePillListeners.delete(listener);
  };
}

function readBalancePillCollapsed(): boolean {
  try {
    return localStorage.getItem(BALANCE_PILL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeBalancePillCollapsed(next: boolean) {
  try {
    localStorage.setItem(BALANCE_PILL_COLLAPSED_KEY, next ? "1" : "0");
  } catch {
    /* private mode / blocked storage */
  }
  for (const listener of balancePillListeners) listener();
}

/** Matches header `h-14` content box after `pb-1` — rem↔rem so height can interpolate. */
const BALANCE_PILL_EXPANDED_H = "3.25rem";
const BALANCE_PILL_COLLAPSED_H = "1.75rem";

const springStyle = {
  transitionDuration: `${SPRING_DURATION_MS}ms`,
  transitionTimingFunction: SPRING_EASE,
} satisfies CSSProperties;

const collapseStyle = {
  transitionDuration: `${SPRING_DURATION_MS}ms`,
  transitionTimingFunction: COLLAPSE_EASE,
} satisfies CSSProperties;

function BrandBeta() {
  return (
    <span className="inline-flex origin-left translate-y-[2px] scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-brand-logo px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-topbar-accent-foreground dark:bg-brand-on-topbar dark:text-brand">
      Beta
    </span>
  );
}

function BrandLink({
  className,
  /** `auto` follows the leftover slot (`@container/brand`). `wordmark` is the md+ nav column. */
  lockup = "auto",
}: {
  className?: string;
  lockup?: "auto" | "wordmark";
}) {
  const auto = lockup === "auto";
  return (
    <Link
      href="/desk"
      aria-label="Edgeways home"
      className={cn(
        "flex w-max max-w-full items-center gap-2 transition-opacity sm:hover:opacity-90",
        appNavInset,
        className
      )}
    >
      {/*
        Wrappers own display so we do not fight EdgewaysLogo's `inline-block`.
        13.5rem is wordmark + Beta + inset (~12.8rem) plus a little air.
      */}
      <span className={auto ? "hidden @[13.5rem]/brand:flex" : "flex"}>
        <EdgewaysLogo topbar />
      </span>
      {auto ? (
        <span className="flex @[13.5rem]/brand:hidden">
          <EdgewaysBolt className="fill-brand-logo dark:fill-brand-on-topbar" />
        </span>
      ) : null}
      <BrandBeta />
    </Link>
  );
}

/** Profit on the balance pill: shared P&L green, `--negative` after pence round. */
function profitToneClass(value: number): string {
  return isNegativeGbp(value) ? "text-negative" : moneyPositiveClass;
}

/** Single metric column inside the canvas balance pill. */
const stackShell =
  "flex min-h-0 flex-col items-end justify-center gap-0.5 px-1.5 text-[12px] sm:text-xs";

/** Full label on sm+, terse on narrow viewports where the stacks collide. */
function StackLabel({ full, short }: { full: string; short: string }) {
  return (
    <>
      <span className="max-sm:hidden">{full}</span>
      <span className="sm:hidden">{short}</span>
    </>
  );
}

function StackRow({
  label,
  value,
  amountClass,
}: {
  label: ReactNode;
  value: number;
  amountClass?: string;
}) {
  return (
    <span className="flex items-baseline justify-end gap-1 leading-none">
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
      <MoneyFlow
        value={value}
        className={cn("font-bold tabular-nums text-foreground", amountClass)}
      />
    </span>
  );
}

/** Profit above Free bets. Violet amount only when free bets are non-zero. */
function TopBarProfitStack({
  profit,
  freeBets,
  onFreeBets,
}: {
  profit: number;
  freeBets: number;
  onFreeBets: () => void;
}) {
  const freeBetsActive = freeBets > 0.005;
  return (
    <div className={stackShell}>
      <Link
        href="/tracker?tab=pnl"
        className="rounded-sm leading-none transition-opacity sm:hover:opacity-80"
        aria-label={`Profit ${profit.toFixed(2)}`}
      >
        <StackRow label="Profit" value={profit} amountClass={profitToneClass(profit)} />
      </Link>
      <button
        type="button"
        onClick={onFreeBets}
        className="rounded-sm text-right leading-none transition-opacity sm:hover:opacity-80"
        aria-label={`Free bets ${freeBets.toFixed(2)}`}
      >
        <StackRow
          label="Free bets"
          value={freeBets}
          amountClass={
            freeBetsActive ? "text-edge" : undefined
          }
        />
      </button>
    </div>
  );
}

function BankrollRows({
  exchange,
  inBets,
  total,
}: {
  exchange: number;
  inBets: number;
  total: number;
}) {
  const companion = bankrollCompanion(inBets);
  return (
    <>
      {companion === "in-bets" ? (
        <StackRow label="In-bets" value={inBets} />
      ) : (
        <StackRow label={<StackLabel full="Exchange" short="Exch." />} value={exchange} />
      )}
      <StackRow label="Total" value={total} />
    </>
  );
}

/** Exchange (or In-bets) above Total. The right stack is always two rows. */
function TopBarBankrollStack({
  exchange,
  inBets,
  total,
  ownerLines,
}: {
  exchange: number;
  inBets: number;
  total: number;
  ownerLines: Array<{ owner: string; balance: number }>;
}) {
  const chip = (
    <Link
      href="/accounts"
      className={stackShell}
      aria-label={bankrollAriaLabel(exchange, inBets, total)}
    >
      <BankrollRows exchange={exchange} inBets={inBets} total={total} />
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

/** Display-only stacks. The hang tab itself is the tap target on mobile. */
function MobileStatStacks({
  profit,
  freeBets,
  total,
  exchange,
  inBets,
}: {
  profit: number;
  freeBets: number;
  total: number;
  exchange: number;
  inBets: number;
}) {
  const freeBetsActive = freeBets > 0.005;
  return (
    <>
      <div className={stackShell}>
        <StackRow
          label="Profit"
          value={profit}
          amountClass={profitToneClass(profit)}
        />
        <StackRow
          label="Free bets"
          value={freeBets}
          amountClass={freeBetsActive ? "text-edge" : undefined}
        />
      </div>
      <div className={stackShell}>
        <BankrollRows exchange={exchange} inBets={inBets} total={total} />
      </div>
    </>
  );
}

/**
 * Inverted Chrome tab: canvas plate hanging from the top of the header,
 * bottom radii + top ears blending into the topbar. Desktop (`md+`):
 * rightmost. While the burger is visible (`< md`): 12px from the burger,
 * matching the inset above it.
 *
 * Desktop (`sm+`): a 12px bottom strip collapses the metrics up into the
 * topbar; collapsed keeps a short “Show balances” reveal with chevron down.
 * Mobile uses `MobileBalanceTab` (no chevron).
 */
function BalancePill({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeBalancePillCollapsed,
    readBalancePillCollapsed,
    () => false
  );
  /** Skip motion on the first paint after restoring localStorage (avoids expand→collapse flash). */
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMotionReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleCollapsed() {
    writeBalancePillCollapsed(!collapsed);
  }

  const heightMotion = motionReady ? collapseStyle : undefined;
  const fadeMotion = motionReady ? springStyle : undefined;

  return (
    <ChromeTab
      edge="hang"
      className={cn(
        // Top-aligned: header is fixed h-14, so this never reflows the page.
        // Height uses rem↔rem (not %↔rem) so the transition can interpolate.
        "flex self-start text-foreground",
        motionReady && "transition-[height]"
      )}
      style={{
        ...heightMotion,
        height: collapsed ? BALANCE_PILL_COLLAPSED_H : BALANCE_PILL_EXPANDED_H,
      }}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div
          className={cn(
            "grid min-h-0 flex-1",
            motionReady && "transition-[grid-template-rows]"
          )}
          style={{
            ...heightMotion,
            gridTemplateRows: collapsed ? "0fr" : "1fr",
          }}
        >
          <div className="min-h-0 overflow-hidden">
              <div
                className={cn(
                  "flex h-full items-center gap-1 px-2.5 pt-2",
                  motionReady && "transition-[opacity,transform]",
                  collapsed && "-translate-y-2 opacity-0"
                )}
                style={fadeMotion}
              >
              {children}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show balances" : "Hide balances"}
          className={cn(
            "flex w-full shrink-0 items-center justify-center gap-1",
            "rounded-b-[var(--chrome-tab-r-hang-bottom)]",
            "text-muted-foreground transition-[color,height]",
            /* Hover wash only: solid at bottom → 0% at top. */
            "hover:bg-gradient-to-b hover:from-transparent hover:to-selection-subtle hover:text-foreground",
            "focus-visible:bg-gradient-to-b focus-visible:from-transparent focus-visible:to-selection-subtle focus-visible:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            collapsed ? "h-7 px-2.5" : "h-3"
          )}
          style={heightMotion}
        >
          {collapsed ? (
            <>
              <span className="text-xs font-medium leading-none">Show balances</span>
              <ChevronDown className="size-3 shrink-0" aria-hidden />
            </>
          ) : (
            <ChevronUp className="size-3 shrink-0" aria-hidden />
          )}
        </button>
      </div>
    </ChromeTab>
  );
}

/** Mobile hang tab: always expanded, no chevron, whole plate opens the sheet. */
function MobileBalanceTab({
  children,
  onOpen,
  ariaLabel,
}: {
  children: ReactNode;
  onOpen: () => void;
  ariaLabel: string;
}) {
  return (
    <ChromeTab
      edge="hang"
      className="flex min-h-[3.25rem] self-start text-foreground"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className={cn(
          "flex min-h-[3.25rem] w-full items-center gap-1 px-2.5 py-2",
          "rounded-b-[var(--chrome-tab-r-hang-bottom)]",
          "transition-opacity active:opacity-80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        )}
      >
        {children}
      </button>
    </ChromeTab>
  );
}

/** Logo and bankroll stacks — ink chrome under the yellow top stripe. */
function AppTopBarHeader() {
  const { state } = useAppState(5000);
  const { openFreeBets, openBalances } = useFreeBets();
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

  return (
    <div
      className={cn(
        // Fixed height so the balance pill collapse never reflows the page below
        "flex h-14 w-full items-stretch overflow-visible",
        appShellGap,
        "px-0 pb-1 sm:px-[var(--layout-page-x)]",
        appShellMaxWidth
      )}
    >
      {/* Leftover slot is a container: wordmark when it is ≥ 13.5rem, else bolt. */}
      <div className="@container/brand min-w-0 flex-1 self-center md:hidden">
        <BrandLink />
      </div>
      <div className={cn("hidden self-center md:block", appNavColumn)}>
        <BrandLink lockup="wordmark" />
      </div>

      <div className="ml-auto flex w-max shrink-0 items-stretch justify-end gap-1 md:gap-1.5">
        {state?.demoMode ? (
          <span className={cn(demoDataTag, "hidden self-center shrink-0 sm:inline-flex")}>
            Demo data
          </span>
        ) : null}

        {state == null ? null : (
          <>
            <div className="hidden items-stretch overflow-visible pl-[var(--chrome-tab-r-hang)] sm:flex md:px-[var(--chrome-tab-r-hang)]">
              <BalancePill>
                <TopBarProfitStack
                  profit={profit}
                  freeBets={freeBetsTotal}
                  onFreeBets={openFreeBets}
                />
                <TopBarBankrollStack
                  exchange={exchange}
                  inBets={inBets}
                  total={bankroll}
                  ownerLines={ownerBalances}
                />
              </BalancePill>
            </div>
            <div className="flex items-stretch overflow-visible pl-[var(--chrome-tab-r-hang)] sm:hidden">
              <MobileBalanceTab
                onOpen={() => openBalances("balances")}
                ariaLabel={balancesSheetAriaLabel(
                  profit,
                  freeBetsTotal,
                  exchange,
                  inBets,
                  bankroll
                )}
              >
                <MobileStatStacks
                  profit={profit}
                  freeBets={freeBetsTotal}
                  total={bankroll}
                  exchange={exchange}
                  inBets={inBets}
                />
              </MobileBalanceTab>
            </div>
          </>
        )}

        <div className="ml-2 flex shrink-0 items-center md:hidden">
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
