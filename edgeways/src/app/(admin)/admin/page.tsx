import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { loadStripeOverview } from "@/lib/admin/stripe-overview";
import { loadActivityOverview } from "@/lib/admin/activity";
import { listAppUsers } from "@/lib/services/app-users";
import { listWaitlistSignups } from "@/lib/services/waitlist-store";
import { loadFeedMonitor, loadFeedStatus } from "@/lib/admin/feeds";
import { FEED_STATE_LABEL } from "@/lib/admin/feed-monitor";
import { readMaintenanceBanner } from "@/lib/admin/operator-settings";
import { sectionTitle, tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const [stripe, users, waitlist, feeds, feedMonitor, banner, activity] = await Promise.all([
    loadStripeOverview(),
    listAppUsers(),
    listWaitlistSignups(500),
    loadFeedStatus(),
    loadFeedMonitor(),
    readMaintenanceBanner(),
    loadActivityOverview(),
  ]);
  const admins = users.filter((user) => user.admin).length;
  const paid = users.filter(
    (user) => user.plan === "core" || user.plan === "edge"
  ).length;
  const deskEntries = activity.rows.reduce(
    (sum, row) => sum + row.bets + row.offers + row.history,
    0
  );

  const nowByHref: Record<string, string> = {
    "/admin/payments": stripe.mrrLabel,
    "/admin/subscribers": `${users.length} account${users.length === 1 ? "" : "s"}`,
    "/admin/users": `${admins} admin`,
    "/admin/activity": activity.available
      ? `${deskEntries} entr${deskEntries === 1 ? "y" : "ies"}`
      : "Local desk",
    "/admin/feeds": feeds.football.configured
      ? `${feedMonitor.football.used}/${feedMonitor.football.cap} football${
          feedMonitor.football.state === "ok"
            ? ""
            : ` — ${FEED_STATE_LABEL[feedMonitor.football.state]}`
        }`
      : feeds.racing.configured
        ? "Racing set"
        : "Unset",
    "/admin/releases": banner.enabled ? "Banner on" : "Banner off",
  };

  return (
    <AdminPage
      title="Operator admin"
      description="Payments, accounts, feeds and flags. Customer desks stay on /desk."
      icon={LayoutDashboard}
    >
      <StatStrip columns={4}>
        <StatTile
          label="MRR"
          value={stripe.mrrLabel}
          sub={stripe.configured ? "Stripe" : "Not connected"}
        />
        <StatTile label="Accounts" value={String(users.length)} sub={`${admins} admin`} />
        <StatTile label="Paid plans" value={String(paid)} sub={`${stripe.founding} founding`} />
        <StatTile
          label="Waitlist"
          value={String(waitlist.length)}
          sub={banner.enabled ? "Banner on" : "Banner off"}
        />
      </StatStrip>

      <section>
        <h2 className={sectionTitle}>Sections</h2>
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Section</TableHead>
              <TableHead className={tableHeaderCell}>Now</TableHead>
              <TableHead className={cn(tableHeaderCell, "text-right")}>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ADMIN_NAV.filter((item) => item.href !== "/admin").map((item) => (
              <TableRow key={item.href}>
                <TableCell className={tableBodyCell}>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.blurb}</p>
                </TableCell>
                <TableCell className={cn(tableBodyCell, "text-muted-foreground")}>
                  {nowByHref[item.href] ?? "—"}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "text-right")}>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-primary-text hover:underline"
                  >
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
      </section>
    </AdminPage>
  );
}
