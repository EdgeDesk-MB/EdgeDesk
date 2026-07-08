"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Calculator,
  CalendarSearch,
  Gift,
  History,
  NotebookPen,
  Plus,
  Radio,
  Trophy,
  Wallet,
} from "lucide-react";
import { FootballIcon } from "@/components/sport-icon";
import { navLinkState } from "@/lib/ui/surface-styles";
import { appNavColumn } from "@/lib/ui/app-shell-layout";
import { useAddBalance } from "@/components/add-balance-provider";
import { useAddBet } from "@/components/add-bet-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { useAppState } from "@/hooks/use-app-state";
import { effectiveEventStatus } from "@/lib/events";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/offers", label: "Offers", icon: Gift },
  {
    href: "/calculators",
    label: "Calculators",
    icon: Calculator,
    quickAction: "matchedCalculator" as const,
  },
  {
    href: "/tracker",
    label: "Profit Tracker",
    icon: NotebookPen,
    quickAction: "addBet" as const,
  },
  {
    href: "/balances",
    label: "Balances",
    icon: Wallet,
    quickAction: "addBalance" as const,
  },
  {
    href: "/tracked-events",
    label: "Tracked Events",
    icon: Radio,
    livePulse: true,
    quickAction: "trackFixture" as const,
  },
  {
    href: "/racing",
    label: "Racing Desk",
    icon: Trophy,
    livePulse: true,
  },
  {
    href: "/calculators/ep-desk",
    label: "EP Desk",
    icon: FootballIcon,
  },
  { href: "/fixtures", label: "Fixtures", icon: CalendarSearch },
];

export function AppNav() {
  const pathname = usePathname();
  const { openAddBalance } = useAddBalance();
  const { openAddBet } = useAddBet();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openTrackFixture } = useTrackFixture();
  const { state } = useAppState(5000);
  const liveTrackedCount = useMemo(
    () => (state?.events ?? []).filter((e) => effectiveEventStatus(e) === "live").length,
    [state?.events]
  );

  return (
    <aside
      className={cn(
        "sticky top-[calc(var(--layout-header-h)+var(--layout-page-x))] hidden h-fit shrink-0 flex-col self-start overflow-hidden pt-4 md:flex",
        appNavColumn
      )}
    >
      <nav className="flex flex-1 flex-col gap-0.5">
        {links.map(({ href, label, icon: Icon, quickAction, livePulse }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : href === "/calculators"
                ? pathname.startsWith("/calculators") &&
                  !pathname.startsWith("/calculators/ep-desk")
                : pathname.startsWith(href);
          const iconLive = livePulse && liveTrackedCount > 0;
          const quickIcon =
            quickAction === "matchedCalculator" ? (
              <Calculator className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            );
          const quickLabel =
            quickAction === "addBalance"
              ? "Add balance"
              : quickAction === "addBet"
                ? "Add bet"
                : quickAction === "matchedCalculator"
                  ? "Open matched betting calculator"
                  : quickAction === "trackFixture"
                    ? "Browse fixtures to track"
                    : undefined;
          const onQuickAction =
            quickAction === "addBalance"
              ? openAddBalance
              : quickAction === "addBet"
                ? () => openAddBet()
                : quickAction === "matchedCalculator"
                  ? () => openMatchedCalculator()
                  : quickAction === "trackFixture"
                    ? openTrackFixture
                    : undefined;

          return (
            <div key={href} className="relative w-full min-w-0">
              <Link
                href={href}
                className={cn(navLinkState(active), quickAction && "pr-10")}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    iconLive && !active && "animate-pulse text-emerald-600",
                    iconLive && active && "animate-pulse"
                  )}
                />
                <span className="truncate">{label}</span>
              </Link>
              {quickAction && onQuickAction && (
                <button
                  type="button"
                  className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={quickLabel}
                  onClick={onQuickAction}
                >
                  {quickIcon}
                </button>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
