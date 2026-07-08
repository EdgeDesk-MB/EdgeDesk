"use client";

import Link from "next/link";
import { UserCircle } from "lucide-react";
import { EdgeDeskLogoIcon } from "@/components/edge-desk-logo-icon";
import { AppTopBarMenu, TopBarButton } from "@/components/app-top-bar-menu";
import { MoneyFlow } from "@/components/money-flow";
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

export function AppTopBar() {
  const { state } = useAppState(5000);
  const bankroll = state?.balances?.total ?? 0;

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-topbar-border bg-topbar text-topbar-foreground">
      <div
        className={cn("flex h-12 w-full items-center", appShellGap, appShellPadding)}
      >
        <BrandLink className="md:hidden" />
        <div className={cn("hidden md:block", appNavColumn)}>
          <BrandLink />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <Link
            href="/balances"
            className="hidden h-8 items-center gap-2 rounded-lg bg-topbar-accent px-2.5 text-sm transition-colors hover:bg-topbar-accent/80 sm:flex"
          >
            <span className="text-topbar-muted">Bankroll</span>
            <MoneyFlow value={bankroll} className="font-bold tabular-nums" />
          </Link>

          <Link
            href="/balances"
            className="flex h-8 items-center rounded-lg bg-topbar-accent px-2 transition-colors hover:bg-topbar-accent/80 sm:hidden"
            aria-label="View bankroll"
          >
            <MoneyFlow value={bankroll} className="text-sm font-bold tabular-nums" />
          </Link>

          <TopBarButton
            className="gap-2 px-2.5 text-xs font-extrabold uppercase tracking-wide"
            aria-label="Sign in — coming soon"
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
