import {
  Activity,
  CreditCard,
  Flag,
  LayoutDashboard,
  Radio,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    blurb: "Payments, accounts, feeds and flags at a glance.",
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    blurb: "Stripe MRR, invoices, refunds and founding-rate holders. Read only.",
  },
  {
    href: "/admin/subscribers",
    label: "Subscribers",
    icon: Users,
    blurb: "Plans, trials, waitlist and waitlist-to-paid.",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Shield,
    blurb: "Grant or revoke operator admin. Bootstrap email is locked.",
  },
  {
    href: "/admin/activity",
    label: "Activity",
    icon: Activity,
    blurb: "Per-desk volume counts. Not another customer’s bets or wallets.",
  },
  {
    href: "/admin/feeds",
    label: "Feeds",
    icon: Radio,
    blurb: "Operator-held football, racing and exchange diagnostics.",
  },
  {
    href: "/admin/releases",
    label: "Releases",
    icon: Flag,
    blurb: "PostHog flags and a maintenance banner. No deploy button.",
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
