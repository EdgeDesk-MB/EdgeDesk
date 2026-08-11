/**
 * Desktop top-bar sub-navigation (Betfair-style).
 *
 * "Desk" = the working product (side nav, dashboards, desks). Meta tabs are
 * generic pages that sit outside day-to-day betting workflow. Adjust labels /
 * hrefs / icons here - the top bar and mobile drawer read this list.
 */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  LayoutDashboard,
  Map,
  MessageCircle,
  MessageSquarePlus,
  ScrollText,
  Settings,
} from "lucide-react";

export type MetaNavItem = {
  /** Stable id for keys / analytics */
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * Path prefixes that keep this tab selected (in addition to `href`).
   * Desk uses the inverse: selected when no other meta tab matches.
   */
  matchPrefixes?: readonly string[];
};

/** Working-product tab - selected on every non-meta route. */
export const DESK_NAV_ITEM: MetaNavItem = {
  id: "desk",
  label: "Desk",
  href: "/desk",
  icon: LayoutDashboard,
};

/**
 * Meta / utility tabs. Order = left-to-right after Desk.
 * Support remains a lightweight stub; Feedback is the send channel.
 */
export const META_NAV_ITEMS: readonly MetaNavItem[] = [
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    matchPrefixes: ["/settings"],
  },
  {
    id: "support",
    label: "Support",
    href: "/support",
    icon: MessageCircle,
    matchPrefixes: ["/support"],
  },
  {
    id: "guides",
    label: "Guides",
    href: "/help",
    icon: BookOpen,
    matchPrefixes: ["/help"],
  },
  {
    id: "release-notes",
    label: "Release notes",
    href: "/release-notes",
    icon: ScrollText,
    matchPrefixes: ["/release-notes"],
  },
  {
    id: "roadmap",
    label: "Roadmap",
    href: "/roadmap",
    icon: Map,
    matchPrefixes: ["/roadmap"],
  },
  {
    id: "feedback",
    label: "Feedback",
    href: "/feedback",
    icon: MessageSquarePlus,
    matchPrefixes: ["/feedback", "/contact"],
  },
] as const;

export const TOP_SUB_NAV_ITEMS: readonly MetaNavItem[] = [
  DESK_NAV_ITEM,
  ...META_NAV_ITEMS,
];

/** Full-width shell (no side nav) — all meta submenu route prefixes. */
const META_SHELL_PREFIXES: readonly string[] = META_NAV_ITEMS.flatMap(
  (item) => item.matchPrefixes ?? [item.href]
);

export function isMetaPath(pathname: string): boolean {
  return META_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function metaItemMatches(pathname: string, item: MetaNavItem): boolean {
  if (item.id === "desk") return !isMetaPath(pathname);
  const prefixes = item.matchPrefixes ?? [item.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function activeMetaNavId(pathname: string): string {
  const hit = META_NAV_ITEMS.find((item) => metaItemMatches(pathname, item));
  return hit?.id ?? DESK_NAV_ITEM.id;
}
