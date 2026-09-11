import { Activity } from "lucide-react";
import {
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminActivityBoard } from "@/components/admin/admin-activity-board";
import { AdminActivityChart } from "@/components/admin/admin-activity-chart";
import { AdminActivityMix } from "@/components/admin/admin-activity-mix";
import { AdminActivityPins } from "@/components/admin/admin-activity-pins";
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
import { latestActivityYmd, resolveActivityMixDay } from "@/lib/admin/activity-day";
import {
  activitySportLabel,
  buildActivityMixCharts,
  filterActivityMix,
  leadingSportByUser,
} from "@/lib/admin/activity-mix";
import {
  excludedIdSet,
  hiddenAccountsSub,
} from "@/lib/admin/exclude-accounts";
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
import { loadActivityMixForDay, loadActivityOverview, loadActivityPins } from "@/lib/admin/activity";
import { readActivityBoardLayout } from "@/lib/admin/activity-board-server";
import {
  attachActivityPins,
  buildActivityPinView,
  filterActivityPins,
} from "@/lib/admin/activity-pins";
import { loadFlagsLinks } from "@/lib/admin/flags";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const params = await searchParams;
  const [activity, scope, pinDesks, board] = await Promise.all([
    loadActivityOverview(),
    loadAdminAccountScope(),
    loadActivityPins(),
    readActivityBoardLayout(),
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
  const mixDay = params.day
    ? resolveActivityMixDay(params.day)
    : latestActivityYmd([
        ...scoped.stamps.bets.map((stamp) => stamp.at),
        ...scoped.stamps.offers.map((stamp) => stamp.at),
        ...scoped.stamps.casino.map((stamp) => stamp.at),
      ]);
  const dayMix = await loadActivityMixForDay(mixDay);
  const bets = scoped.rows.reduce((sum, row) => sum + row.bets, 0);
  const offers = scoped.rows.reduce((sum, row) => sum + row.offers, 0);
  const charts = buildActivityCharts(scoped.rows, scoped.daily);
  const skipIds = excludedIdSet(excludedIds);
  if (excludeAdmins) {
    for (const row of activity.rows) {
      if (row.admin) skipIds.add(row.clerkUserId);
    }
  }
  const mixCharts = buildActivityMixCharts(
    filterActivityMix(dayMix, skipIds.size > 0 ? skipIds : null)
  );
  const leadingSports = leadingSportByUser(scoped.mix.betSports);
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
  const allPinAccounts = attachActivityPins(activity.rows, pinDesks);
  const pinView = buildActivityPinView(
    attachActivityPins(
      scoped.rows,
      filterActivityPins(pinDesks, skipIds.size > 0 ? skipIds : null)
    )
  );
  const pinsFilteredOut =
    pinView.desksWithPins === 0 &&
    (excludeAdmins || excludedIds.length > 0) &&
    allPinAccounts.some((row) => row.football.length + row.racing.length > 0);

  return (
    <AdminPage
      title="Activity"
      description="Feature usage and desk volume. Counts only."
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
        <StatTile
          label="Pins"
          value={String(pinView.desksWithPins)}
          sub={
            pinView.desks > 0
              ? `${pinView.desksWithPins} of ${pinView.desks}`
              : undefined
          }
        />
      </StatStrip>
      <AdminCompareStrip
        heading="Versus last week"
        items={[
          { label: "Bets", compare: charts.week.bets, period: "week" },
          { label: "Offers", compare: charts.week.offers, period: "week" },
          { label: "Casino", compare: charts.week.casino, period: "week" },
        ]}
      />
      <AdminActivityBoard
        layout={board}
        pins={
          <AdminActivityPins
            key="pins"
            view={pinView}
            available={activity.available}
            filteredOut={pinsFilteredOut}
            compact
          />
        }
        timeline={
          <AdminActivityChart key="timeline" events={activityEvents} compact />
        }
        volume={
          <AdminChartGrid key="volume">
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
        }
        categories={
          activity.available && scoped.rows.length > 0 ? (
            <AdminActivityMix key="categories" charts={mixCharts} day={mixDay} />
          ) : undefined
        }
        desks={
          scoped.rows.length === 0 ? (
            <EmptyState
              key="desks-empty"
              icon={Activity}
              title={
                !activity.available
                  ? "Hosted desk needed"
                  : activity.rows.length === 0
                    ? "No accounts yet"
                    : "No customer accounts"
              }
              description={
                activity.rows.length > 0 &&
                (excludeAdmins || excludedIds.length > 0)
                  ? "Turn off Exclude admins, or include test accounts on Users, to see more desks."
                  : (activity.note ??
                    "Accounts appear here after someone signs in on the hosted desk.")
              }
            />
          ) : (
            <AdminSection key="desks" title="Per desk">
              <AdminTableFrame>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={tableHeaderCell}>Email</TableHead>
                      <TableHead className={tableHeaderCell}>Plan</TableHead>
                      <TableHead className={tableHeaderCell}>
                        Top sport
                      </TableHead>
                      <TableHead className={tableHeaderCell}>
                        This week
                      </TableHead>
                      <TableHead className={tableHeaderCell}>Bets</TableHead>
                      <TableHead className={tableHeaderCell}>Offers</TableHead>
                      <TableHead className={tableHeaderCell}>Casino</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((row) => {
                      const lead = leadingSports.get(row.clerkUserId);
                      const leadLabel = lead
                        ? activitySportLabel(lead.key)
                        : null;
                      return (
                        <TableRow key={row.clerkUserId}>
                          <TableCell
                            className={cn(
                              tableBodyCell,
                              "max-w-[18rem] truncate"
                            )}
                            title={row.email ?? row.clerkUserId}
                          >
                            {row.email ?? row.clerkUserId}
                          </TableCell>
                          <TableCell
                            className={cn(tableBodyCell, "capitalize")}
                          >
                            {row.plan}
                          </TableCell>
                          <TableCell
                            className={cn(
                              tableBodyCell,
                              "min-w-0 whitespace-normal"
                            )}
                            title={leadLabel ?? undefined}
                          >
                            {lead && leadLabel ? (
                              <div className="min-w-0">
                                <p className="font-medium text-pretty break-words">
                                  {leadLabel}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {lead.n} of {lead.total}
                                </p>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              tableBodyCell,
                              "font-semibold tabular-nums"
                            )}
                          >
                            {weekly.get(row.clerkUserId) ?? 0}
                          </TableCell>
                          <TableCell className={tableBodyCell}>
                            {row.bets}
                          </TableCell>
                          <TableCell className={tableBodyCell}>
                            {row.offers}
                          </TableCell>
                          <TableCell className={tableBodyCell}>
                            {row.casino}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AdminTableFrame>
            </AdminSection>
          )
        }
      />
      {scoped.rows.length > 0 && activity.note ? (
        <p className="text-sm text-muted-foreground">{activity.note}</p>
      ) : null}
    </AdminPage>
  );
}
