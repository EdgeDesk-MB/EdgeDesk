"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { EdgewaysLogo } from "@/components/edgeways-logo-icon";
import { AppTopBarMenu } from "@/components/app-top-bar-menu";
import { AppTopBarMetaNav } from "@/components/app-top-bar-meta-nav";
import { ChromeTab } from "@/components/chrome-tab";
import { MoneyFlow } from "@/components/money-flow";
import { isNegativeGbp } from "@/lib/format-money";
import { useFreeBets } from "@/components/accounts/free-bets-convert-dialog";
import { useEffect, useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { accountOwner } from "@/lib/accounts/owners";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  appNavColumn,
  appNavInset,
  appShellGap,
  appShellMaxWidth,
} from "@/lib/ui/app-shell-layout";
import { COLLAPSE_EASE, SPRING_DURATION_MS, SPRING_EASE } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

const BALANCE_PILL_COLLAPSED_KEY = "edgeways.balancePillCollapsed";

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

function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/desk"
      aria-label="Edgeways home"
      className={cn(
        "flex shrink-0 items-center gap-2 transition-opacity sm:hover:opacity-90",
        appNavInset,
        className
      )}
    >
      <EdgewaysLogo topbar />
      {/* Same geometry as racing-desk “Backed”; plate tracks the lockup colour. */}
      <span className="inline-flex origin-left translate-y-[2px] scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-brand-logo px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-topbar-accent-foreground dark:bg-brand-on-topbar dark:text-brand">
        Beta
      </span>
    </Link>
  );
}

/** Profit on the balance pill: green when ≥ 0, red when negative after pence round. */
function profitToneClass(value: number): string {
  return isNegativeGbp(value)
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";
}

/** Single metric column inside the canvas balance pill. */
const stackShell =
  "flex min-h-0 flex-col items-end justify-center gap-0.5 px-1.5 text-[12px] sm:text-xs";

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
            freeBetsActive ? "text-violet-600 dark:text-violet-400" : undefined
          }
        />
      </button>
    </div>
  );
}

/** Exchange above Total. Total alone centres vertically when exchange is hidden. */
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
  // Exchange and In-bets share the first row — In-bets wins when present.
  const showExchangeRow = showExchange && !showInBets;
  const chip = (
    <Link
      href="/accounts"
      className={stackShell}
      aria-label={
        showInBets
          ? `Bankroll: in-bets ${inBets.toFixed(2)}, total ${total.toFixed(2)}`
          : showExchangeRow
            ? `Bankroll: exchange ${exchange.toFixed(2)}, total ${total.toFixed(2)}`
            : `Bankroll total ${total.toFixed(2)}`
      }
    >
      {showExchangeRow ? <StackRow label="Exchange" value={exchange} /> : null}
      {showInBets ? <StackRow label="In-bets" value={inBets} /> : null}
      <StackRow label="Total" value={total} />
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
  onFreeBets,
  total,
  exchange,
  showExchange,
}: {
  profit: number;
  freeBets: number;
  onFreeBets: () => void;
  total: number;
  exchange: number;
  showExchange: boolean;
}) {
  const freeBetsActive = freeBets > 0.005;
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
        <button type="button" onClick={onFreeBets} aria-label={`Free bets ${freeBets.toFixed(2)}`}>
          <StackRow
            label="Free bets"
            value={freeBets}
            amountClass={
              freeBetsActive ? "text-violet-600 dark:text-violet-400" : undefined
            }
          />
        </button>
      </div>
      <Link
        href="/accounts"
        className={stackShell}
        aria-label={
          showExchange
            ? `Bankroll: exchange ${exchange.toFixed(2)}, total ${total.toFixed(2)}`
            : `Bankroll total ${total.toFixed(2)}`
        }
      >
        {showExchange ? <StackRow label="Exchange" value={exchange} /> : null}
        <StackRow label="Total" value={total} />
      </Link>
    </>
  );
}

/**
 * Inverted Chrome tab: canvas plate hanging from the top of the header,
 * bottom radii + top ears blending into the topbar. Desktop (`md+`):
 * rightmost. While the burger is visible (`< md`): 12px from the burger,
 * matching the inset above it.
 *
 * Bottom 12px strip collapses the metrics up into the topbar; collapsed
 * state keeps a short “Show balances” reveal with chevron down.
 */
function BalancePill({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  /** Skip motion on the first paint after restoring localStorage (avoids expand→collapse flash). */
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(BALANCE_PILL_COLLAPSED_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* private mode / blocked storage */
    }
    const id = requestAnimationFrame(() => setMotionReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BALANCE_PILL_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
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

/** Logo and bankroll stacks — ink chrome under the yellow top stripe. */
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
  const showExchange = exchange > 0.005;

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
      <BrandLink className="self-center md:hidden" />
      <div className={cn("hidden self-center md:block", appNavColumn)}>
        <BrandLink />
      </div>

      <div className="flex min-w-0 flex-1 items-stretch justify-end gap-1 md:gap-1.5">
        {state?.demoMode ? (
          <span className="self-center shrink-0 rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-warning sm:text-[11px]">
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
                  showExchange={showExchange}
                  ownerLines={ownerBalances}
                />
              </BalancePill>
            </div>
            <div className="flex items-stretch overflow-visible pl-[var(--chrome-tab-r-hang)] sm:hidden">
              <BalancePill>
                <MobileStatStacks
                  profit={profit}
                  freeBets={freeBetsTotal}
                  onFreeBets={openFreeBets}
                  total={bankroll}
                  exchange={exchange}
                  showExchange={showExchange}
                />
              </BalancePill>
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
