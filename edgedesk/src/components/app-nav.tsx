"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type MouseEvent,
} from "react";
import { monoAccentActive, navLinkState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import {
  Home,
  Calculator,
  CalendarDays,
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
import { appNavColumn } from "@/lib/ui/app-shell-layout";
import { useAddBalance } from "@/components/add-balance-provider";
import { useAddBet } from "@/components/add-bet-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useAppState } from "@/hooks/use-app-state";
import { effectiveEventStatus } from "@/lib/events";
import { listOfferNextActions } from "@/lib/offers/next-actions";
import {
  availableBookieNames,
  offerMatchesAvailableBookies,
} from "@/lib/accounts/available-bookies";
import { countDeskQueue } from "@/lib/bets/desk-queues";

type NavIcon = ComponentType<{ className?: string }>;

type NavLeaf = {
  kind: "link";
  href: string;
  label: string;
  icon: NavIcon;
  quickAction?: "addBalance" | "addBet" | "matchedCalculator" | "trackFixture";
  livePulse?: boolean;
};

type NavGroup = {
  kind: "group";
  label: string;
  icon: NavIcon;
  /** Default destination when the parent is clicked (collapsed) */
  href: string;
  /** Section prefix - leaving it auto-collapses */
  baseHref: string;
  children: Array<{ href: string; label: string; icon: NavIcon }>;
};

type NavEntry = NavLeaf | NavGroup;

const entries: NavEntry[] = [
  { kind: "link", href: "/", label: "Home", icon: Home },
  { kind: "link", href: "/history", label: "History", icon: History },
  {
    kind: "group",
    label: "Offers",
    icon: Gift,
    /** Always open the first sub-nav item */
    href: "/offers/calendar",
    baseHref: "/offers",
    children: [
      { href: "/offers/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/offers", label: "Campaigns", icon: Gift },
    ],
  },
  {
    kind: "link",
    href: "/calculators",
    label: "Calculators",
    icon: Calculator,
    quickAction: "matchedCalculator",
  },
  {
    kind: "link",
    href: "/tracker",
    label: "Profit Tracker",
    icon: NotebookPen,
    quickAction: "addBet",
  },
  {
    kind: "link",
    href: "/tracked-events",
    label: "Tracked Events",
    icon: Radio,
    livePulse: true,
    quickAction: "trackFixture",
  },
  {
    kind: "link",
    href: "/accounts",
    label: "Accounts",
    icon: Wallet,
    quickAction: "addBalance",
  },
  {
    kind: "link",
    href: "/racing",
    label: "Racing Desk",
    icon: Trophy,
    livePulse: true,
  },
  {
    kind: "link",
    href: "/calculators/ep-desk",
    label: "2UP Desk",
    icon: FootballIcon,
  },
  { kind: "link", href: "/fixtures", label: "Fixtures", icon: CalendarSearch },
];

/**
 * Flat main-nav list for the mobile burger menu - derived from `entries` so
 * the two navigations can never drift apart.
 */
export const flatNavLinks: Array<{ href: string; label: string; icon: NavIcon }> =
  entries.flatMap((entry) =>
    entry.kind === "link"
      ? [{ href: entry.href, label: entry.label, icon: entry.icon }]
      : entry.children.map((child) => ({
          href: child.href,
          label: `${entry.label} · ${child.label}`,
          icon: child.icon,
        }))
  );

/** Matches quick-action (+) / calculator icons on sibling rows */
const navTrailingSlot =
  "absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center";

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/offers") {
    return pathname === "/offers" || pathname.startsWith("/offers?");
  }
  if (href === "/offers/calendar") {
    return pathname.startsWith("/offers/calendar");
  }
  if (href === "/calculators") {
    return (
      pathname.startsWith("/calculators") && !pathname.startsWith("/calculators/ep-desk")
    );
  }
  return pathname.startsWith(href);
}

function ActionBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
        monoAccentActive
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const { openAddBalance } = useAddBalance();
  const { openAddBet } = useAddBet();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openTrackFixture } = useTrackFixture();
  const { openOffer } = useOfferDialog();
  const { state } = useAppState(5000);
  const liveTrackedCount = useMemo(
    () => (state?.events ?? []).filter((e) => effectiveEventStatus(e) === "live").length,
    [state?.events]
  );
  const offerActionCount = useMemo(() => {
    const offers = state?.offers ?? [];
    const available = availableBookieNames(state?.balances?.accounts ?? []);
    const scoped =
      available.size === 0
        ? offers
        : offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, available));
    return listOfferNextActions(scoped).length;
  }, [state?.offers, state?.balances?.accounts]);

  const settleQueueCount = useMemo(() => {
    const bets = state?.bets ?? [];
    const events = state?.events ?? [];
    const eventById = new Map(events.map((e) => [e.id, e]));
    return countDeskQueue(bets, "settle", eventById);
  }, [state?.bets, state?.events]);

  /** Manual collapse while still on an Offers route */
  const [offersUserCollapsed, setOffersUserCollapsed] = useState(false);
  const offersInSection = pathname.startsWith("/offers");

  useEffect(() => {
    if (!offersInSection) setOffersUserCollapsed(false);
  }, [offersInSection]);

  function renderLeaf(item: NavLeaf) {
    const href =
      item.href === "/tracker" && settleQueueCount > 0
        ? "/tracker?queue=settle"
        : item.href;
    const Icon = item.icon;
    const active = isLinkActive(pathname, item.href);
    const quickAction = item.quickAction;
    const livePulse = item.livePulse;
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
          <span className="truncate">{item.label}</span>
          {href === "/tracker" ? <ActionBadge count={settleQueueCount} /> : null}
        </Link>
        {quickAction && onQuickAction && (
          <button
            type="button"
            className={cn(
              navTrailingSlot,
              "rounded-md text-muted-foreground transition-colors hover:text-foreground"
            )}
            aria-label={quickLabel}
            onClick={onQuickAction}
          >
            {quickIcon}
          </button>
        )}
      </div>
    );
  }

  function renderGroup(entry: NavGroup) {
    const inSection = pathname.startsWith(entry.baseHref);
    const expanded = inSection && !offersUserCollapsed;
    const GroupIcon = entry.icon;
    const parentActive = inSection;
    const firstChildHref = entry.children[0]?.href ?? entry.href;

    function onParentClick(e: MouseEvent<HTMLAnchorElement>) {
      if (expanded) {
        e.preventDefault();
        setOffersUserCollapsed(true);
        return;
      }
      // Expanding: always land on the first sub-nav item
      setOffersUserCollapsed(false);
      if (pathname === firstChildHref || pathname.startsWith(`${firstChildHref}?`)) {
        e.preventDefault();
      }
      // else: Link navigates to firstChildHref (entry.href)
    }

    return (
      <div key={entry.baseHref} className="flex flex-col gap-0.5">
        <div className="relative w-full min-w-0">
          <Link
            href={firstChildHref}
            onClick={onParentClick}
            className={cn(navLinkState(parentActive), "pr-10")}
            aria-expanded={expanded}
          >
            <GroupIcon className="size-4 shrink-0" />
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{entry.label}</span>
              <ActionBadge count={offerActionCount} />
            </span>
          </Link>
          <button
            type="button"
            className={cn(
              navTrailingSlot,
              "rounded-md text-muted-foreground transition-colors hover:text-foreground"
            )}
            aria-label="New offer"
            onClick={() => openOffer()}
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="nav-sub-panel" data-open={expanded ? "true" : "false"}>
          <div className="nav-sub-panel-inner">
            <div className="flex flex-col gap-0.5 pb-0.5">
              {entry.children.map((child) => {
                const active = isLinkActive(pathname, child.href);
                const ChildIcon = child.icon;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(navLinkState(active), "py-1.5 pl-9 text-[13px]")}
                    tabIndex={expanded ? undefined : -1}
                  >
                    <ChildIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "sticky top-[var(--layout-page-x)] hidden h-fit shrink-0 flex-col self-start pt-4 md:flex",
        appNavColumn
      )}
    >
      <nav className="flex flex-1 flex-col gap-0.5 px-0.5">
        {entries.map((entry) => {
          if (entry.kind === "group") return renderGroup(entry);
          return renderLeaf(entry);
        })}
      </nav>
    </aside>
  );
}
