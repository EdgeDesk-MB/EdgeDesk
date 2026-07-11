"use client";

import Link from "next/link";
import { UserCircle } from "lucide-react";
import { EdgeDeskLogoIcon } from "@/components/edge-desk-logo-icon";
import { AppTopBarMenu, TopBarButton } from "@/components/app-top-bar-menu";
import { MoneyFlow } from "@/components/money-flow";
import { useFreeBets } from "@/components/accounts/free-bets-convert-dialog";
import { useAppState } from "@/hooks/use-app-state";
import {
  appNavColumn,
  appNavInset,
  appShellGap,
  appShellPadding,
} from "@/lib/ui/app-shell-layout";
import { cn } from "@/lib/utils";

function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90",
        appNavInset,
        className
      )}
    >
      <EdgeDeskLogoIcon />
      <span className="truncate text-base font-extrabold tracking-tight">EdgeDesk</span>
    </Link>
  );
}

/** Profit on the dark top bar: green when ≥ 0, red when negative. */
function profitToneClass(value: number): string {
  return value < -0.004 ? "text-red-400" : "text-emerald-400";
}

function TopBarStat({
  href,
  label,
  value,
  profitTone,
  freeBetTone,
  onClick,
  className,
}: {
  href?: string;
  label: string;
  value: number;
  profitTone?: boolean;
  freeBetTone?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const amountClass = cn(
    "font-bold tabular-nums",
    freeBetTone
      ? "text-violet-400"
      : profitTone
        ? profitToneClass(value)
        : "text-topbar-foreground"
  );
  const shell = cn(
    "hidden h-8 items-center gap-2 rounded-lg bg-topbar-accent px-2.5 text-sm transition-colors hover:bg-topbar-accent/80 sm:flex",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        <span className="text-topbar-muted">{label}</span>
        <MoneyFlow value={value} className={amountClass} />
      </button>
    );
  }

  return (
    <Link href={href ?? "/"} className={shell}>
      <span className="text-topbar-muted">{label}</span>
      <MoneyFlow value={value} className={amountClass} />
    </Link>
  );
}

function TopBarBankroll({
  exchange,
  inBets,
  total,
}: {
  exchange: number;
  inBets: number;
  total: number;
}) {
  const showInBets = inBets > 0.005;
  const parts = [
    { label: "Exchange", value: exchange },
    ...(showInBets ? [{ label: "In-bets", value: inBets }] : []),
    { label: "Total", value: total },
  ] as const;

  return (
    <Link
      href="/accounts"
      className="hidden h-8 items-center rounded-lg bg-topbar-accent px-2.5 text-sm transition-colors hover:bg-topbar-accent/80 sm:flex"
      aria-label={
        showInBets
          ? `Bankroll: exchange ${exchange.toFixed(2)}, in-bets ${inBets.toFixed(2)}, total ${total.toFixed(2)}`
          : `Bankroll: exchange ${exchange.toFixed(2)}, total ${total.toFixed(2)}`
      }
    >
      {parts.map((part, i) => (
        <span key={part.label} className="flex items-center">
          {i > 0 ? (
            <span
              className="mx-2 h-[1em] w-px shrink-0 self-center bg-topbar-muted/50"
              aria-hidden
            />
          ) : null}
          <span className="flex items-center gap-1.5 leading-none">
            <span className="text-topbar-muted">{part.label}</span>
            <MoneyFlow
              value={part.value}
              className="font-bold tabular-nums text-topbar-foreground"
            />
          </span>
        </span>
      ))}
    </Link>
  );
}

export function AppTopBar() {
  const { state } = useAppState(5000);
  const { openFreeBets } = useFreeBets();
  const balances = state?.balances;
  const exchange = balances?.exchanges ?? 0;
  const inBets = balances?.inBets ?? 0;
  const bankroll = balances?.bankroll ?? balances?.total ?? 0;
  const profit = (state?.settledProfit ?? 0) + (state?.provisionalProfit ?? 0);
  const freeBetsTotal =
    balances?.accounts
      ?.filter((a) => a.type === "bookie")
      .reduce((s, a) => s + (a.freeBets ?? 0), 0) ?? 0;
  const showFreeBets = freeBetsTotal > 0.005;

  return (
    <header className="relative z-[45] shrink-0 border-b border-topbar-border bg-topbar text-topbar-foreground">
      <div className={cn("flex h-12 w-full items-center", appShellGap, appShellPadding)}>
        <BrandLink className="md:hidden" />
        <div className={cn("hidden md:block", appNavColumn)}>
          <BrandLink />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          {showFreeBets ? (
            <TopBarStat
              label="Free bets"
              value={freeBetsTotal}
              freeBetTone
              onClick={openFreeBets}
            />
          ) : null}
          <TopBarStat href="/tracker?tab=pnl" label="Profit" value={profit} profitTone />
          <TopBarBankroll exchange={exchange} inBets={inBets} total={bankroll} />

          {showFreeBets ? (
            <button
              type="button"
              onClick={openFreeBets}
              className="flex h-8 items-center rounded-lg bg-topbar-accent px-2 transition-colors hover:bg-topbar-accent/80 sm:hidden"
              aria-label={`Free bets ${freeBetsTotal.toFixed(2)}`}
            >
              <MoneyFlow
                value={freeBetsTotal}
                className="text-sm font-bold tabular-nums text-violet-400"
              />
            </button>
          ) : null}
          <Link
            href="/tracker?tab=pnl"
            className="flex h-8 items-center rounded-lg bg-topbar-accent px-2 transition-colors hover:bg-topbar-accent/80 sm:hidden"
            aria-label="View profit"
          >
            <MoneyFlow
              value={profit}
              className={cn("text-sm font-bold tabular-nums", profitToneClass(profit))}
            />
          </Link>
          <Link
            href="/accounts"
            className="flex h-8 items-center rounded-lg bg-topbar-accent px-2 transition-colors hover:bg-topbar-accent/80 sm:hidden"
            aria-label={`Bankroll total ${bankroll.toFixed(2)}`}
          >
            <MoneyFlow value={bankroll} className="text-sm font-bold tabular-nums" />
          </Link>

          <TopBarButton
            className="gap-2 px-2.5 text-xs font-extrabold uppercase tracking-wide"
            aria-label="Sign in - coming soon"
          >
            <UserCircle className="size-4 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline">Login</span>
          </TopBarButton>

          <AppTopBarMenu />
        </div>
      </div>
    </header>
  );
}
