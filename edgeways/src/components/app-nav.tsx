"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { readChromeSnapshot, type ChromeSnapshot } from "@/lib/chrome-snapshot";
import { SPRING_DURATION_MS } from "@/lib/ui/motion";
import { toast } from "sonner";
import { ExchangeNamePicker } from "@/components/bookie-name-picker";
import { ThemeSelect } from "@/components/theme-select";
import {
  brandChipCount,
  captionHeading,
  coreNavTag,
  edgeMarkerPill,
  edgeNavTag,
  navLinkState,
  proNavTag,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BellRing,
  Home,
  Calculator,
  CalendarDays,
  CalendarSearch,
  Dices,
  Gift,
  Grid2x2,
  History,
  Layers,
  Lock,
  NotebookPen,
  Plus,
  Puzzle,
  Radio,
  Scale,
  Timer,
  Zap,
  Wallet,
} from "lucide-react";
import { requiredPlan } from "@/lib/entitlements/plans";
import { canDesk } from "@/lib/entitlements/effective-plan";
import type { FeatureFlag } from "@/lib/entitlements/features";
import { planLockCopy } from "@/lib/entitlements/nav";
import { HorseRacingIcon } from "@/components/sport-icon";
import { useAddBalance } from "@/components/add-balance-provider";
import { useAddBet } from "@/components/add-bet-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { useBoostCheck } from "@/components/boosts/boost-check-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import { countLiveNavEvents, type NavLivePulseScope } from "@/lib/events";
import { listOfferNextActions } from "@/lib/offers/next-actions";
import {
  offerMatchesAvailableBookies,
  visibleBookieNames,
} from "@/lib/accounts/available-bookies";
import { countDeskQueue } from "@/lib/bets/desk-queues";
import { isEventPendingSettle } from "@/lib/racing/pending-settle";
import {
  useOfferEdgeRaceCount,
  useRacingOfferEdgeKey,
} from "@/hooks/use-offer-edge-race-count";
import { prefetchDeskPageApis } from "@/lib/prefetch-desk-pages";
import { usePublicDemo } from "@/components/demo/public-demo-provider";

type NavIcon = ComponentType<{ className?: string }>;

type NavLeaf = {
  kind: "link";
  href: string;
  label: string;
  icon: NavIcon;
  /** N0 flag. Locked rows stay visible with a Core/Edge mark. */
  feature?: FeatureFlag;
  quickAction?: "addBalance" | "addBet" | "matchedCalculator" | "trackFixture" | "boostCheck";
  livePulse?: NavLivePulseScope;
};

type NavGroup = {
  kind: "group";
  label: string;
  icon: NavIcon;
  /** Default destination when the parent is clicked (collapsed) */
  href: string;
  /** Collapse-state key; also the default path prefix when matchPrefixes is omitted */
  baseHref: string;
  /**
   * Path prefixes that keep the group expanded (e.g. Combo Desk spans /acca
   * and /bet-builder). Defaults to [baseHref].
   */
  matchPrefixes?: string[];
  children: Array<{ href: string; label: string; icon: NavIcon; feature?: FeatureFlag }>;
  /** N0 flag for the parent row (children may override). */
  feature?: FeatureFlag;
  quickAction?: "newOffer" | "casinoLog";
};

function prefetchNavHref(href: string) {
  prefetchDeskPageApis(href);
}

function groupMatchPrefixes(group: NavGroup): string[] {
  return group.matchPrefixes ?? [group.baseHref];
}

function isGroupPath(pathname: string, group: NavGroup): boolean {
  return groupMatchPrefixes(group).some((prefix) => pathname.startsWith(prefix));
}

type NavEntry = NavLeaf | NavGroup;

export interface NavSection {
  /** null = the unlabelled top section */
  label: string | null;
  entries: NavEntry[];
  /** Tiny brand-yellow Pro mark beside the section label */
  pro?: boolean;
}

/**
 * The single source of truth for main navigation - sidebar sections, the
 * mobile drawer and the command palette all derive from this.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    entries: [
      { kind: "link", href: "/desk", label: "Home", icon: Home },
      { kind: "link", href: "/alerts", label: "Alerts", icon: BellRing },
      { kind: "link", href: "/history", label: "History", icon: History },
      {
        kind: "link",
        href: "/accounts",
        label: "Accounts",
        icon: Wallet,
        quickAction: "addBalance",
      },
      { kind: "link", href: "/fixtures", label: "Fixtures", icon: CalendarSearch },
      {
        kind: "link",
        href: "/tracked-events",
        label: "Tracked Events",
        icon: Radio,
        livePulse: "all",
        quickAction: "trackFixture",
      },
    ],
  },
  {
    label: "Betting",
    entries: [
      {
        kind: "group",
        label: "Offers",
        icon: Gift,
        /** Always open the first sub-nav item */
        href: "/offers/calendar",
        baseHref: "/offers",
        feature: "offers_pipeline",
        quickAction: "newOffer",
        children: [
          { href: "/offers/calendar", label: "Calendar", icon: CalendarDays, feature: "offers_pipeline" },
          { href: "/offers", label: "Campaigns", icon: Gift, feature: "offers_pipeline" },
        ],
      },
      {
        kind: "link",
        href: "/tracker",
        label: "Profit Tracker",
        icon: NotebookPen,
        feature: "calculators",
        quickAction: "addBet",
      },
      { kind: "link", href: "/match-checker", label: "Match Checker", icon: Scale },
      { kind: "link", href: "/boosts", label: "Boosts", icon: Zap, quickAction: "boostCheck" },
      {
        kind: "group",
        label: "Casino",
        icon: Dices,
        href: "/casino/calendar",
        baseHref: "/casino",
        quickAction: "casinoLog",
        children: [
          { href: "/casino/calendar", label: "Calendar", icon: CalendarDays },
          { href: "/casino", label: "Campaigns", icon: Dices },
        ],
      },
      {
        kind: "link",
        href: "/calculators",
        label: "Calculators",
        icon: Calculator,
        quickAction: "matchedCalculator",
      },
    ],
  },
  {
    label: "Live desks",
    entries: [
      {
        kind: "link",
        href: "/racing",
        label: "Racing",
        icon: HorseRacingIcon,
        livePulse: "racing",
      },
      {
        kind: "link",
        href: "/early-payout",
        label: "Early-payout",
        icon: Timer,
      },
      {
        kind: "group",
        label: "Combo",
        icon: Layers,
        href: "/acca",
        baseHref: "/acca",
        feature: "acca_desk",
        matchPrefixes: ["/acca", "/bet-builder", "/systems"],
        children: [
          { href: "/acca", label: "Accumulator", icon: Layers, feature: "acca_desk" },
          { href: "/bet-builder", label: "Bet Builder", icon: Puzzle, feature: "bet_builder_desk" },
          { href: "/systems", label: "Systems", icon: Grid2x2, feature: "systems_desk" },
        ],
      },
    ],
  },
  {
    label: "Insights",
    entries: [
      {
        kind: "link",
        href: "/report",
        label: "Edge Report",
        icon: BarChart3,
        feature: "do_next",
      },
    ],
  },
];

const entries: NavEntry[] = NAV_SECTIONS.flatMap((s) => s.entries);

/** Every collapsible group nav renders - drives the generic collapse-state tracking below. */
const navGroups: NavGroup[] = entries.filter((e): e is NavGroup => e.kind === "group");

/**
 * Flat main-nav list for the command palette - derived from the sections so
 * the navigations can never drift apart.
 */
export const flatNavLinks = flattenNavEntries(entries);

/** Matches quick-action (+) / calculator icons on sibling rows */
const navTrailingSlot =
  "absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center";

/** Flatten sections/groups to plain links - shared by palette and drawer. */
export function flattenNavEntries(
  navEntries: NavEntry[]
): Array<{
  href: string;
  label: string;
  icon: NavIcon;
  feature?: FeatureFlag;
  /** Group children. Plan mark stays on the parent row only. */
  isSubNav?: boolean;
}> {
  return navEntries.flatMap((entry) =>
    entry.kind === "link"
      ? [{ href: entry.href, label: entry.label, icon: entry.icon, feature: entry.feature }]
      : entry.children.map((child) => ({
          href: child.href,
          label: `${entry.label} · ${child.label}`,
          icon: child.icon,
          feature: child.feature ?? entry.feature,
          isSubNav: true,
        }))
  );
}

/** Parent group row should navigate unless we are already on its landing href. */
export function isGroupLandingPath(pathname: string, firstChildHref: string): boolean {
  return pathname === firstChildHref || pathname.startsWith(`${firstChildHref}?`);
}

export function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/desk") return pathname === "/desk";
  if (href === "/offers") {
    return pathname === "/offers" || pathname.startsWith("/offers?");
  }
  if (href === "/offers/calendar") {
    return pathname.startsWith("/offers/calendar");
  }
  if (href === "/casino") {
    return pathname === "/casino" || pathname.startsWith("/casino?");
  }
  if (href === "/casino/calendar") {
    return pathname.startsWith("/casino/calendar");
  }
  if (href === "/calculators") {
    return (
      pathname.startsWith("/calculators")
    );
  }
  return pathname.startsWith(href);
}

export function ActionBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className={brandChipCount}>
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function PlanNavMark({
  feature,
  locked,
}: {
  feature: FeatureFlag;
  locked: boolean;
}) {
  if (!locked) return null;
  const plan = requiredPlan(feature);
  return (
    <>
      <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className={plan === "edge" ? edgeNavTag : coreNavTag}>
        {plan === "edge" ? "Edge" : "Core"}
      </span>
    </>
  );
}

export function toastPlanLock(feature: FeatureFlag, opts?: { real?: boolean }) {
  const copy = planLockCopy(feature, opts);
  toast.message(copy.title, { description: copy.description });
}

/** Offer Edge race count beside Racing Desk — Edge-tier chrome (zap + count). */
export function EdgeRaceNavMark({ count }: { count: number }) {
  const prevCount = useRef<number | null>(null);
  const [shining, setShining] = useState(false);

  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = count;
    // Skip the first observation; shine only when the number actually changes.
    if (prev === null || prev === count || count <= 0) return;
    // Retrigger if a sweep is already running (rapid successive changes).
    setShining(false);
    const raf = requestAnimationFrame(() => setShining(true));
    // Fallback if the ::after animationend does not surface on the host.
    const clear = window.setTimeout(() => setShining(false), 1000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clear);
    };
  }, [count]);

  function onAnimationEnd(e: AnimationEvent<HTMLSpanElement>) {
    if (e.animationName !== "sheen-sweep-once") return;
    setShining(false);
  }

  if (count <= 0) return null;
  return (
    <span
      className={cn(
        edgeMarkerPill,
        "edge-count-mark overflow-hidden",
        shining && "is-shining"
      )}
      title={`${count} Race pick${count === 1 ? "" : "s"} today`}
      onAnimationEnd={onAnimationEnd}
    >
      <Zap className="size-3" aria-hidden />
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function NavSectionLabel({
  label,
  pro,
  className,
}: {
  label: string;
  pro?: boolean;
  className?: string;
}) {
  return (
    <p className={cn(captionHeading, "flex items-center gap-1.5", className)}>
      <span>{label}</span>
      {pro ? <span className={proNavTag}>Pro</span> : null}
    </p>
  );
}

/**
 * Height-animated sub-nav slot. Soft mask while opening/closing so labels
 * fade at the clip edge; `data-settled` clears the mask once open height lands.
 */
function NavSubPanel({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  const [settled, setSettled] = useState(expanded);
  const [prevExpanded, setPrevExpanded] = useState(expanded);

  if (prevExpanded !== expanded) {
    setPrevExpanded(expanded);
    if (!expanded) setSettled(false);
  }

  useEffect(() => {
    if (!expanded) return;
    // Fallback if transitionend is skipped (reduced motion / already at target).
    const t = window.setTimeout(() => setSettled(true), SPRING_DURATION_MS + 40);
    return () => clearTimeout(t);
  }, [expanded]);

  function onTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "grid-template-rows") return;
    if (expanded) setSettled(true);
  }

  return (
    <div
      className="nav-sub-panel"
      data-open={expanded ? "true" : "false"}
      data-settled={settled ? "true" : "false"}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="nav-sub-panel-inner">{children}</div>
    </div>
  );
}

/** Same default-exchange preference as Settings → Bet defaults. */
function NavDefaultExchange() {
  const { exchanges, defaultExchange, refresh } = useExchanges();

  async function setDefaultByName(name: string) {
    const ex = exchanges.find(
      (e) => e.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (!ex || ex.id === defaultExchange?.id) return;
    try {
      await api(`/api/exchanges/${ex.id}`, {
        method: "PATCH",
        json: { isDefault: true },
      });
      toast.success(`${ex.name} is now default`);
      await refresh();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-1.5">
      <p className={captionHeading}>Default exchange</p>
      <ExchangeNamePicker
        label=""
        allowCustom={false}
        size="sm"
        className="w-full"
        value={defaultExchange?.name ?? ""}
        onChange={setDefaultByName}
      />
      {exchanges.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Add exchanges on Accounts first.
        </p>
      ) : null}
    </div>
  );
}

export function AppNav() {
  const pathname = usePathname() ?? "";
  const { openAddBalance } = useAddBalance();
  const { openAddBet } = useAddBet();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openTrackFixture } = useTrackFixture();
  const { openCasinoLog } = useCasinoLog();
  const { openBoostCheck } = useBoostCheck();
  const { openOffer } = useOfferDialog();
  const { demoHref } = usePublicDemo();
  const { state } = useAppState(5000);
  const [cachedChrome, setCachedChrome] = useState<ChromeSnapshot | null>(null);
  useLayoutEffect(() => {
    setCachedChrome(readChromeSnapshot());
  }, []);
  const settings = state?.settings ?? cachedChrome?.settings;
  const liveTrackedCount = useMemo(
    () => countLiveNavEvents(state?.events ?? [], "all"),
    [state?.events]
  );
  const liveRacingCount = useMemo(
    () => countLiveNavEvents(state?.events ?? [], "racing"),
    [state?.events]
  );
  const offerActionCount = useMemo(() => {
    const offers = state?.offers ?? [];
    // Matches Do next scoping: gubbed bookies count, closed ones do not.
    const visible = visibleBookieNames(state?.balances?.accounts ?? []);
    const scoped =
      visible.size === 0
        ? offers
        : offers.filter((o) => offerMatchesAvailableBookies(o.bookmaker, visible));
    return listOfferNextActions(scoped).length;
  }, [state?.offers, state?.balances?.accounts]);

  const openBetCount = useMemo(
    () => countDeskQueue(state?.bets ?? [], "open"),
    [state?.bets]
  );

  const settleQueueCount = useMemo(() => {
    const bets = state?.bets ?? [];
    const events = state?.events ?? [];
    const eventById = new Map(events.map((e) => [e.id, e]));
    return countDeskQueue(bets, "settle", eventById);
  }, [state?.bets, state?.events]);

  const boostsOpenCount = state?.boostsOpen ?? cachedChrome?.boostsOpen ?? 0;
  const casinoNeedsActionCount =
    state?.casinoNeedsAction ?? cachedChrome?.casinoNeedsAction ?? 0;
  const accaLayDueCount =
    state?.accaLayDue?.length ?? cachedChrome?.accaLayDueCount ?? 0;
  const betBuilderLayDueCount =
    state?.betBuilderLayDue?.length ?? cachedChrome?.betBuilderLayDueCount ?? 0;
  const comboLayDueCount = accaLayDueCount + betBuilderLayDueCount;
  const racingPendingSettleCount = useMemo(
    () => (state?.events ?? []).filter((e) => isEventPendingSettle(e)).length,
    [state?.events]
  );
  const racingOfferKey = useRacingOfferEdgeKey(state?.offers);
  const edgeRaceCount = useOfferEdgeRaceCount(settings, racingOfferKey);

  /** Manual collapse per group (keyed by baseHref) while still on that group's route */
  const [userCollapsed, setUserCollapsed] = useState<Record<string, boolean>>({});

  // Adjust-during-render (the sanctioned pattern): leaving a group's section
  // clears its manual collapse so the next visit starts expanded.
  const [wasInSection, setWasInSection] = useState<Record<string, boolean>>({});
  for (const group of navGroups) {
    const inSection = isGroupPath(pathname, group);
    if (wasInSection[group.baseHref] !== inSection) {
      setWasInSection((prev) => ({ ...prev, [group.baseHref]: inSection }));
      if (!inSection) setUserCollapsed((prev) => ({ ...prev, [group.baseHref]: false }));
    }
  }

  function renderLeaf(item: NavLeaf) {
    // Prefer settle when work is due; otherwise land on the open queue.
    const href =
      item.href === "/tracker"
        ? settleQueueCount > 0
          ? "/tracker?queue=settle"
          : openBetCount > 0
            ? "/tracker?queue=open"
            : item.href
        : item.href;
    const Icon = item.icon;
    const active = isLinkActive(pathname, item.href);
    const quickAction = item.quickAction;
    const livePulse = item.livePulse;
    const iconLive =
      livePulse === "racing"
        ? liveRacingCount > 0
        : livePulse === "all"
          ? liveTrackedCount > 0
          : false;
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
              : quickAction === "boostCheck"
                ? "Check a boost"
                : undefined;
    const onQuickAction =
      quickAction === "addBalance"
        ? () => openAddBalance()
        : quickAction === "addBet"
          ? () => openAddBet()
          : quickAction === "matchedCalculator"
            ? () => openMatchedCalculator()
            : quickAction === "trackFixture"
              ? () => openTrackFixture()
              : quickAction === "boostCheck"
                ? () => openBoostCheck()
                : undefined;

    const leafBadge =
      item.href === "/tracker"
        ? openBetCount
        : item.href === "/boosts"
          ? boostsOpenCount
            : item.href === "/alerts"
            ? (state?.alertsUnread ?? cachedChrome?.alertsUnread ?? 0)
            : item.href === "/racing"
              ? racingPendingSettleCount
              : 0;
    const locked = Boolean(
      item.feature && !canDesk(settings, item.feature)
    );

    return (
      <div key={item.href} className="relative w-full min-w-0">
        <Link
          href={demoHref(href)}
          prefetch
          onPointerEnter={() => prefetchNavHref(item.href)}
          onFocus={() => prefetchNavHref(item.href)}
          className={cn(navLinkState(active), quickAction && !locked && "pr-10")}
        >
          <Icon
            className={cn(
              "size-4 shrink-0",
              iconLive && !active && "animate-pulse text-profit",
              iconLive && active && "animate-pulse"
            )}
          />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{item.label}</span>
            {item.feature ? (
              <PlanNavMark feature={item.feature} locked={locked} />
            ) : null}
            {item.href === "/racing" ? <EdgeRaceNavMark count={edgeRaceCount} /> : null}
            {!locked ? <ActionBadge count={leafBadge} /> : null}
          </span>
        </Link>
        {quickAction && onQuickAction && !locked ? (
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
        ) : null}
      </div>
    );
  }

  function renderGroup(entry: NavGroup) {
    const inSection = isGroupPath(pathname, entry);
    const collapsed = userCollapsed[entry.baseHref] ?? false;
    const expanded = inSection && !collapsed;
    const GroupIcon = entry.icon;
    const parentActive = inSection;
    const firstChildHref = entry.children[0]?.href ?? entry.href;
    const badgeCount =
      entry.baseHref === "/offers"
        ? offerActionCount
        : entry.baseHref === "/casino"
          ? casinoNeedsActionCount
          : entry.matchPrefixes?.includes("/bet-builder")
            ? comboLayDueCount
            : 0;
    const quickLabel =
      entry.quickAction === "newOffer"
        ? "New offer"
        : entry.quickAction === "casinoLog"
          ? "Log offer"
          : undefined;
    const onQuickAction =
      entry.quickAction === "newOffer"
        ? () => openOffer()
        : entry.quickAction === "casinoLog"
          ? openCasinoLog
          : undefined;
    const locked = Boolean(
      entry.feature && !canDesk(settings, entry.feature)
    );

    function onParentClick(e: MouseEvent<HTMLAnchorElement>) {
      // Only swallow the click when we are already on the landing page
      // (toggle the sub-nav). From Campaigns, Home, or anywhere else the
      // parent must still navigate, even if the group is expanded.
      if (isGroupLandingPath(pathname, firstChildHref)) {
        e.preventDefault();
        setUserCollapsed((prev) => ({ ...prev, [entry.baseHref]: expanded }));
        return;
      }
      setUserCollapsed((prev) => ({ ...prev, [entry.baseHref]: false }));
    }

    return (
      <div key={entry.baseHref} className="flex flex-col gap-0.5">
        <div className="relative w-full min-w-0">
          <Link
            href={demoHref(firstChildHref)}
            prefetch
            onPointerEnter={() => prefetchNavHref(firstChildHref)}
            onFocus={() => prefetchNavHref(firstChildHref)}
            onClick={onParentClick}
            className={cn(navLinkState(parentActive), onQuickAction && !locked && "pr-10")}
            aria-expanded={expanded}
          >
            <GroupIcon className="size-4 shrink-0" />
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{entry.label}</span>
              {entry.feature ? (
                <PlanNavMark feature={entry.feature} locked={locked} />
              ) : null}
              {!locked && badgeCount > 0 ? <ActionBadge count={badgeCount} /> : null}
            </span>
          </Link>
          {onQuickAction && !locked ? (
            <button
              type="button"
              className={cn(
                navTrailingSlot,
                "rounded-md text-muted-foreground transition-colors hover:text-foreground"
              )}
              aria-label={quickLabel}
              onClick={onQuickAction}
            >
              <Plus className="size-3.5" />
            </button>
          ) : null}
        </div>

        <NavSubPanel expanded={expanded}>
          <div className="flex flex-col gap-0.5 pb-0.5">
            {entry.children.map((child) => {
              const active = isLinkActive(pathname, child.href);
              const ChildIcon = child.icon;
              const childFeature = child.feature ?? entry.feature;
              const childLocked = Boolean(
                childFeature && !canDesk(settings, childFeature)
              );
              const childBadge =
                child.href === "/acca"
                  ? accaLayDueCount
                  : child.href === "/bet-builder"
                    ? betBuilderLayDueCount
                    : 0;
              return (
                <Link
                  key={child.href}
                  href={demoHref(child.href)}
                  prefetch
                  onPointerEnter={() => prefetchNavHref(child.href)}
                  onFocus={() => prefetchNavHref(child.href)}
                  className={cn(navLinkState(active), "py-1.5 pl-9 text-[13px]")}
                  tabIndex={expanded ? undefined : -1}
                >
                  <ChildIcon className="size-3.5 shrink-0" />
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{child.label}</span>
                    {!childLocked ? <ActionBadge count={childBadge} /> : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </NavSubPanel>
      </div>
    );
  }

  return (
    <nav className="flex flex-col px-0.5">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? "top"} className="flex flex-col gap-0.5">
            {section.label ? (
              <NavSectionLabel
                label={section.label}
                pro={section.pro}
                className={cn("px-3 pb-1", i > 0 ? "pt-4" : "pt-1")}
              />
            ) : null}
            {section.entries.map((entry) => {
              if (entry.kind === "group") return renderGroup(entry);
              return renderLeaf(entry);
            })}
            {i < NAV_SECTIONS.length - 1 ? <div className="h-3" /> : null}
          </div>
        ))}
        <div className="flex flex-col gap-0.5">
          <p className={cn(captionHeading, "px-3 pb-1 pt-8")}>Settings</p>
          <div className="flex flex-col gap-2 px-3 pb-0">
            <ThemeSelect className="w-full" />
            <NavDefaultExchange />
          </div>
        </div>
    </nav>
  );
}
