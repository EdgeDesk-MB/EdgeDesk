import {
  Activity,
  Bell,
  CreditCard,
  Flag,
  HeartPulse,
  Inbox,
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
    blurb: "Stripe MRR, invoices, refunds and Founding-rate holders. Read only.",
  },
  {
    href: "/admin/subscribers",
    label: "Subscribers",
    icon: Users,
    blurb: "Plans, trials, Founding list and last active.",
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Shield,
    blurb: "Grant or revoke operator admin. Hide test accounts. Owner live alerts.",
  },
  {
    href: "/admin/activity",
    label: "Activity",
    icon: Activity,
    blurb: "Per-desk volume and category mix. Not another customer’s bets or wallets.",
  },
  {
    href: "/admin/live",
    label: "Live",
    icon: Bell,
    blurb: "When it happened, as rows. The same bundles as toasts, kept here.",
  },
  {
    href: "/admin/inbox",
    label: "Inbox",
    icon: Inbox,
    blurb: "Feedback reports from the desk. Read only; filing stays in triage.",
  },
  {
    href: "/admin/feeds",
    label: "Feeds",
    icon: Radio,
    blurb: "Operator-held football, racing and exchange. One feed serves every Edge desk.",
  },
  {
    href: "/admin/releases",
    label: "Releases",
    icon: Flag,
    blurb: "PostHog flags and a site banner. No deploy button.",
  },
  {
    href: "/admin/health",
    label: "Health",
    icon: HeartPulse,
    blurb: "Is it up, and which mode. Services, deploy and feed status.",
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
