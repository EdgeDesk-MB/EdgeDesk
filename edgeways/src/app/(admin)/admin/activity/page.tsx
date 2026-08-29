import { Activity } from "lucide-react";
import {
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminActivityChart } from "@/components/admin/admin-activity-chart";
import { AdminActivityMix } from "@/components/admin/admin-activity-mix";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminAccountFilters } from "@/components/admin/admin-account-filters";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import {
  activityEventsFromStamps,
  buildActivityCharts,
  scopeActivityView,
  weeklyCountsByUser,
} from "@/lib/admin/activity-charts";
import { buildActivityMixCharts } from "@/lib/admin/activity-mix";
import { hiddenAccountsSub } from "@/lib/admin/exclude-accounts";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadActivityOverview } from "@/lib/admin/activity";
import { loadFlagsLinks } from "@/lib/admin/flags";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminActivityPage() {
  const [activity, scope] = await Promise.all([
    loadActivityOverview(),
    loadAdminAccountScope(),
  ]);
  const { excludeAdmins, excludedIds } = scope;
  const links = loadFlagsLinks();
  const admins = activity.rows.filter((row) => row.admin).length;
  const scoped = scopeActivityView(
    activity,
    excludeAdmins,
    undefined,
    excludedIds
  );
  const bets = scoped.rows.reduce((sum, row) => sum + row.bets, 0);
  const offers = scoped.rows.reduce((sum, row) => sum + row.offers, 0);
  const casino = scoped.rows.reduce((sum, row) => sum + row.casino, 0);
  const charts = buildActivityCharts(scoped.rows, scoped.daily);
  const mixCharts = buildActivityMixCharts(scoped.mix);
  const activityEvents = activityEventsFromStamps(
    scoped.stamps,
    new Map(scoped.rows.map((row) => [row.clerkUserId, row.email]))
  );
  const weekly = weeklyCountsByUser(scoped.stamps);
  const sortedRows = [...scoped.rows].sort(
    (a, b) => (weekly.get(b.clerkUserId) ?? 0) - (weekly.get(a.clerkUserId) ?? 0)
  );
  const hiddenAdmins = activity.rows.filter(
    (row) => row.admin && !scoped.rows.some((visible) => visible.clerkUserId === row.clerkUserId)
  ).length;

  return (
    <AdminPage
      title="Activity"
      description="Desk volume by account. Counts only."
      icon={Activity}
      action={
        <Button variant="outline" {...pageSecondaryButtonProps} asChild>
          <a href={links.projectHomeUrl} target="_blank" rel="noreferrer">
            Open PostHog
          </a>
        </Button>
      }
      toolbar={
        <AdminAccountFilters
          excludeAdmins={excludeAdmins}
          adminCount={admins}
          excludedCount={excludedIds.length}
        />
      }
    >
      <StatStrip columns={4}>
        <StatTile
          label="Accounts"
          value={String(scoped.rows.length)}
          sub={hiddenAccountsSub(hiddenAdmins, excludeAdmins, excludedIds.length)}
        />
        <StatTile label="Bets" value={String(bets)} />
        <StatTile label="Offers" value={String(offers)} />
        <StatTile label="Casino" value={String(casino)} />
      </StatStrip>
      <AdminCompareStrip
        heading="Versus last week"
        items={[
          { label: "Bets", compare: charts.week.bets, period: "week" },
          { label: "Offers", compare: charts.week.offers, period: "week" },
          { label: "Casino", compare: charts.week.casino, period: "week" },
        ]}
      />
      <AdminActivityChart events={activityEvents} />
      <AdminChartGrid>
        <AdminChartCard
          title="Desk volume mix"
          description="Lifetime bets, sports offers, and casino campaigns, not the last 60 days."
        >
          <AdminDonutChart slices={charts.kindShare} label="Desk volume mix" />
        </AdminChartCard>
        <AdminChartCard
          title="Volume by desk"
          description="Lifetime bets, sports offers, and casino. Email only, never another desk's bets."
        >
          <AdminShareBars slices={charts.deskShare} />
        </AdminChartCard>
      </AdminChartGrid>
      {activity.available && scoped.rows.length > 0 ? (
        <AdminActivityMix charts={mixCharts} />
      ) : null}
      {scoped.rows.length > 0 && activity.note ? (
        <p className="text-sm text-muted-foreground">{activity.note}</p>
      ) : null}
      {scoped.rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={
            !activity.available
              ? "Hosted desk needed"
              : activity.rows.length === 0
                ? "No accounts yet"
                : "No customer accounts"
          }
          description={
            activity.rows.length > 0 && (excludeAdmins || excludedIds.length > 0)
              ? "Turn off Exclude admins, or include test accounts on Users, to see more desks."
              : (activity.note ??
                "Accounts appear here after someone signs in on the hosted desk.")
          }
        />
      ) : (
        <AdminSection title="Per desk">
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Plan</TableHead>
              <TableHead className={tableHeaderCell}>This week</TableHead>
              <TableHead className={tableHeaderCell}>Bets</TableHead>
              <TableHead className={tableHeaderCell}>Offers</TableHead>
              <TableHead className={tableHeaderCell}>Casino</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.clerkUserId}>
                <TableCell
                  className={cn(tableBodyCell, "max-w-[18rem] truncate")}
                  title={row.email ?? row.clerkUserId}
                >
                  {row.email ?? row.clerkUserId}
                </TableCell>
                <TableCell className={cn(tableBodyCell, "capitalize")}>{row.plan}</TableCell>
                <TableCell className={cn(tableBodyCell, "font-semibold tabular-nums")}>
                  {weekly.get(row.clerkUserId) ?? 0}
                </TableCell>
                <TableCell className={tableBodyCell}>{row.bets}</TableCell>
                <TableCell className={tableBodyCell}>{row.offers}</TableCell>
                <TableCell className={tableBodyCell}>{row.casino}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
        </AdminSection>
      )}
    </AdminPage>
  );
}
