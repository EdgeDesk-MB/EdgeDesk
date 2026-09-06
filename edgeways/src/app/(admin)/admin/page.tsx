import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import {
  AdminBarChart,
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { AdminActivityMix } from "@/components/admin/admin-activity-mix";
import { AdminSportsMix } from "@/components/admin/admin-sports-mix";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminAccountFilters } from "@/components/admin/admin-account-filters";
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
import { AttentionStrip } from "@/components/admin/attention-strip";
import { StripeModeChip } from "@/components/admin/stripe-mode-chip";
import { buildActivityCharts, scopeActivityView } from "@/lib/admin/activity-charts";
import { buildActivityMixCharts, sportDeskRows } from "@/lib/admin/activity-mix";
import { addPeriodCompares } from "@/lib/admin/series";
import { loadActivityOverview } from "@/lib/admin/activity";
import { buildAttentionItems } from "@/lib/admin/attention";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import {
  emailsOfExcludedAccounts,
  hiddenAccountsSub,
  hiddenExcludedSub,
  scopeAdminUsers,
  withoutExcludedEmails,
  withoutExcludedFeedback,
} from "@/lib/admin/exclude-accounts";
import { buildAccountGrowth } from "@/lib/admin/growth";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { buildStripeDrift, stripeDriftNote } from "@/lib/admin/stripe-drift";
import { loadStripeOverview } from "@/lib/admin/stripe-overview";
import {
  chartsFromStripeOverview,
  formatPenceGbp,
} from "@/lib/admin/stripe-charts";
import { listAppUsers } from "@/lib/services/app-users";
import { listUntriagedFeedbackReports } from "@/lib/feedback/inbox-store";
import { listAdminLiveLog } from "@/lib/admin/live-log";
import { listWaitlistSignups } from "@/lib/services/waitlist-store";
import { loadFeedMonitor, loadFeedStatus } from "@/lib/admin/feeds";
import { FEED_STATE_LABEL } from "@/lib/admin/feed-monitor";
import { readMaintenanceBanner } from "@/lib/admin/operator-settings";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminOverviewPage() {
  const [stripe, users, waitlist, feeds, feedMonitor, banner, activity, scope, untriaged, liveLog] =
    await Promise.all([
      loadStripeOverview(),
      listAppUsers(),
      listWaitlistSignups(500),
      loadFeedStatus(),
      loadFeedMonitor(),
      readMaintenanceBanner(),
      loadActivityOverview(),
      loadAdminAccountScope(),
      listUntriagedFeedbackReports(),
      listAdminLiveLog(),
    ]);
  const { excludeAdmins, excludedIds } = scope;
  const admins = users.filter((user) => user.admin).length;
  const visibleUsers = scopeAdminUsers(users, { excludeAdmins, excludedIds });
  const excludedEmails = emailsOfExcludedAccounts(users, excludedIds);
  const visibleWaitlist = withoutExcludedEmails(waitlist, excludedEmails);
  const visibleUntriaged = withoutExcludedFeedback(untriaged, excludedEmails);
  const paid = visibleUsers.filter(
    (user) => user.plan === "core" || user.plan === "edge"
  ).length;
  const scopedActivity = scopeActivityView(
    activity,
    excludeAdmins,
    undefined,
    excludedIds
  );
  const deskEntries = scopedActivity.rows.reduce(
    (sum, row) => sum + row.bets + row.offers + row.casino,
    0
  );
  const growth = buildAccountGrowth(visibleUsers, visibleWaitlist);
  const stripeCharts = chartsFromStripeOverview(stripe);
  const activityCharts = buildActivityCharts(
    scopedActivity.rows,
    scopedActivity.daily
  );
  const activityMix = buildActivityMixCharts(scopedActivity.mix);
  const sportRows = sportDeskRows(scopedActivity.mix.betSports);
  const fleetLead = sportRows[0] ?? null;
  const attention = buildAttentionItems({
    stripe,
    users: visibleUsers,
    feedMonitor,
    banner,
    untriaged: visibleUntriaged,
  });
  const drift = stripeDriftNote(
    buildStripeDrift(visibleUsers, stripe.stripeCustomerIds)
  );

  const nowByHref: Record<string, string> = {
    "/admin/payments": stripe.mrrLabel,
    "/admin/subscribers": `${visibleUsers.length} account${visibleUsers.length === 1 ? "" : "s"}`,
    "/admin/users": [
      `${admins} admin`,
      hiddenExcludedSub(excludedIds.length),
    ]
      .filter(Boolean)
      .join(" · "),
    "/admin/activity": activity.available
      ? [
          `${deskEntries} entr${deskEntries === 1 ? "y" : "ies"}`,
          fleetLead?.label ?? null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Local desk",
    "/admin/live":
      liveLog.unread > 0
        ? `${liveLog.unread} unread`
        : liveLog.rows.length > 0
          ? `${liveLog.rows.length} kept`
          : "Quiet",
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
      description="Payments, accounts, feeds and flags."
      icon={LayoutDashboard}
      toolbar={
        <AdminAccountFilters
          excludeAdmins={excludeAdmins}
          adminCount={admins}
          excludedCount={excludedIds.length}
        />
      }
    >
      <AttentionStrip items={attention} />

      <StatStrip columns={4}>
        <StatTile
          label="MRR"
          value={
            <span className="flex items-center gap-2">
              {stripe.mrrLabel}
              {stripe.mode ? <StripeModeChip mode={stripe.mode} /> : null}
            </span>
          }
          sub={stripe.configured ? (drift ?? "Stripe") : "Not connected"}
        />
        <StatTile
          label="Accounts"
          value={String(visibleUsers.length)}
          sub={hiddenAccountsSub(admins, excludeAdmins, excludedIds.length) ?? `${admins} admin`}
        />
        <StatTile
          label="Paid plans"
          value={String(paid)}
          sub={`${visibleUsers.filter((user) => user.founding).length} founding`}
        />
        <StatTile
          label="Waitlist"
          value={String(visibleWaitlist.length)}
          sub={banner.enabled ? "Banner on" : "Banner off"}
        />
      </StatStrip>

      <AdminCompareStrip
        heading="Versus last week"
        items={[
          { label: "Signups", compare: growth.week.signups, period: "week" },
          { label: "Waitlist", compare: growth.week.waitlist, period: "week" },
          ...(stripe.configured
            ? [
                {
                  label: "Paid",
                  compare: stripeCharts.week.paidVolume,
                  period: "week" as const,
                  formatValue: formatPenceGbp,
                },
              ]
            : []),
          ...(activity.available
            ? [
                {
                  label: "Desk volume",
                  compare: addPeriodCompares(
                    activityCharts.week.bets,
                    activityCharts.week.offers,
                    activityCharts.week.casino
                  ),
                  period: "week" as const,
                },
              ]
            : []),
        ]}
      />

      <AdminChartGrid>
        <AdminChartCard
          title="Account signups"
          description="New app_users per UTC day. Quiet days stay on the chart."
        >
          <AdminBarChart series={growth.signups30} label="Account signups" />
        </AdminChartCard>
        <AdminChartCard
          title="Plan mix"
          description="Current plan on each account, not historical conversions."
        >
          <AdminDonutChart slices={growth.planShare} label="Plan mix" />
        </AdminChartCard>
      </AdminChartGrid>

      {stripe.configured ? (
        <AdminChartGrid>
          <AdminChartCard
            title="Paid invoice volume"
            description="Stripe amount_paid, last 30 UTC days."
          >
            <AdminBarChart
              series={stripeCharts.paidVolume30}
              label="Paid invoice volume"
              tone="profit"
              formatValue={formatPenceGbp}
            />
          </AdminChartCard>
          <AdminChartCard
            title="Stripe status"
            description="Every subscription Stripe still lists, including cancelled."
          >
            <AdminDonutChart slices={stripeCharts.statusShare} label="Stripe status" />
          </AdminChartCard>
        </AdminChartGrid>
      ) : null}

      {activity.available ? (
        <>
          <AdminChartGrid>
            <AdminChartCard
              title="Bets placed"
              description="Hosted desk bet rows per UTC day. Counts only."
            >
              <AdminBarChart series={activityCharts.bets30} label="Bets placed" />
            </AdminChartCard>
            <AdminChartCard
              title="Desk volume mix"
              description="Lifetime bets, sports offers, and casino campaigns across accounts."
            >
              <AdminDonutChart slices={activityCharts.kindShare} label="Desk volume mix" />
            </AdminChartCard>
          </AdminChartGrid>
          <AdminSportsMix slices={activityMix.betSports} rows={sportRows} />
          <AdminActivityMix charts={activityMix} variant="preview" />
        </>
      ) : null}

      <AdminSection title="Sections">
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
      </AdminSection>
    </AdminPage>
  );
}
