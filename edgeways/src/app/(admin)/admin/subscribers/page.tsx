import { Users } from "lucide-react";
import {
  AdminBarChart,
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
  AdminLineChart,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { ExcludeAdminsToggle } from "@/components/admin/exclude-admins-toggle";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { readExcludeAdmins } from "@/lib/admin/exclude-admins-server";
import { hiddenAdminsSub, withoutAdmins } from "@/lib/admin/exclude-admins";
import { buildAccountGrowth } from "@/lib/admin/growth";
import { buildAttributionShare, buildWaitlistFunnel } from "@/lib/admin/funnel";
import { buildLeavingRows } from "@/lib/admin/leaving";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin/format";
import { adminBillingStatusLabel } from "@/lib/billing/operator-complimentary";
import { listAppUsers } from "@/lib/services/app-users";
import { listWaitlistSignups } from "@/lib/services/waitlist-store";
import {
  adminModeTag,
  tableBodyCell,
  tableHeaderCell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export default async function AdminSubscribersPage() {
  const [users, waitlist, excludeAdmins] = await Promise.all([
    listAppUsers(),
    listWaitlistSignups(200),
    readExcludeAdmins(),
  ]);
  const admins = users.filter((user) => user.admin).length;
  const visibleUsers = withoutAdmins(users, excludeAdmins);
  const waitlistEmails = new Set(waitlist.map((row) => row.email.toLowerCase()));
  const waitlistToPaid = visibleUsers.filter(
    (user) =>
      user.email &&
      waitlistEmails.has(user.email.toLowerCase()) &&
      (user.plan === "core" || user.plan === "edge")
  ).length;
  const confirmed = waitlist.filter((row) => row.confirmedAt && !row.unsubscribedAt).length;
  const growth = buildAccountGrowth(visibleUsers, waitlist);
  const leaving = buildLeavingRows(visibleUsers);
  const funnel = buildWaitlistFunnel(waitlist, visibleUsers);
  const attributionShare = buildAttributionShare(visibleUsers);

  return (
    <AdminPage
      title="Subscribers"
      description="Account plans from app_users, plus the waitlist. Last active is the last account sync."
      icon={Users}
      toolbar={
        <ExcludeAdminsToggle active={excludeAdmins} hiddenCount={admins} />
      }
    >
      <StatStrip columns={4}>
        <StatTile
          label="Accounts"
          value={String(visibleUsers.length)}
          sub={hiddenAdminsSub(admins, excludeAdmins)}
        />
        <StatTile
          label="Core + Edge"
          value={String(visibleUsers.filter((u) => u.plan === "core" || u.plan === "edge").length)}
        />
        <StatTile label="Waitlist" value={String(waitlist.length)} sub={`${confirmed} confirmed`} />
        <StatTile label="Waitlist to paid" value={String(waitlistToPaid)} />
      </StatStrip>

      <AdminCompareStrip
        heading="Versus last week"
        items={[
          { label: "Signups", compare: growth.week.signups, period: "week" },
          { label: "Waitlist", compare: growth.week.waitlist, period: "week" },
        ]}
      />
      <AdminCompareStrip
        heading="Versus last month"
        items={[
          { label: "Signups", compare: growth.month.signups, period: "month" },
          { label: "Paid-plan", compare: growth.month.paidSignups, period: "month" },
        ]}
      />

      <AdminChartGrid>
        <AdminChartCard
          title="Account signups"
          description="New accounts per UTC day. Quiet days stay on the chart."
        >
          <AdminBarChart series={growth.signups30} label="Account signups" />
        </AdminChartCard>
        <AdminChartCard
          title="Accounts over 30 days"
          description="Running total of signups in this window, not all-time accounts."
        >
          <AdminLineChart
            series={growth.signupsCumulative30}
            label="Accounts over 30 days"
          />
        </AdminChartCard>
      </AdminChartGrid>

      <AdminChartGrid>
        <AdminChartCard
          title="Waitlist joins"
          description="New waitlist rows per UTC day, including unconfirmed."
        >
          <AdminBarChart
            series={growth.waitlist30}
            label="Waitlist joins"
            tone="edge"
          />
        </AdminChartCard>
        <AdminChartCard
          title="Waitlist confirms"
          description="Rows that confirmed on that UTC day."
        >
          <AdminBarChart
            series={growth.confirmed30}
            label="Waitlist confirms"
            tone="success"
          />
        </AdminChartCard>
      </AdminChartGrid>

      <AdminChartGrid>
        <AdminChartCard
          title="Plan mix"
          description="Current plan on each account."
        >
          <AdminDonutChart slices={growth.planShare} label="Plan mix" />
        </AdminChartCard>
        <AdminChartCard
          title="Billing mix"
          description="Complimentary is Edge or Core with no Stripe customer."
        >
          <AdminDonutChart slices={growth.billingShare} label="Billing mix" />
        </AdminChartCard>
      </AdminChartGrid>

      <AdminChartGrid>
        <AdminChartCard
          title="Waitlist funnel"
          description="Joined to confirmed to paid. Each stage is a subset of the one before."
        >
          <AdminShareBars
            slices={[
              { key: "joined", label: "Joined", value: funnel.joined, tone: "brand" },
              { key: "confirmed", label: "Confirmed", value: funnel.confirmed, tone: "edge" },
              { key: "paid", label: "Paid", value: funnel.paid, tone: "profit" },
            ]}
          />
        </AdminChartCard>
        <AdminChartCard
          title="How they heard"
          description="Onboarding attribution across accounts that answered. Skipped and blank left out."
        >
          <AdminDonutChart slices={attributionShare} label="How they heard" />
        </AdminChartCard>
      </AdminChartGrid>

      {leaving.length > 0 ? (
        <AdminSection
          title="Leaving"
          description="Trials ending within 7 days and scheduled cancels, soonest first."
        >
          <AdminTableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeaderCell}>Email</TableHead>
                  <TableHead className={tableHeaderCell}>Plan</TableHead>
                  <TableHead className={tableHeaderCell}>Reason</TableHead>
                  <TableHead className={tableHeaderCell}>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaving.map((row) => (
                  <TableRow key={row.clerkUserId}>
                    <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate")}>
                      {row.email ?? row.clerkUserId}
                    </TableCell>
                    <TableCell className={cn(tableBodyCell, "capitalize")}>{row.plan}</TableCell>
                    <TableCell className={cn(tableBodyCell, "text-warning")}>{row.reason}</TableCell>
                    <TableCell className={tableBodyCell}>{formatAdminDateTime(row.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AdminTableFrame>
        </AdminSection>
      ) : null}

      <AdminSection title="Accounts">
        {visibleUsers.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title={users.length === 0 ? "No accounts yet" : "No customer accounts"}
            description={
              users.length === 0
                ? "Accounts appear here after someone signs in."
                : "Turn off Exclude admins to see operator accounts."
            }
          />
        ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Plan</TableHead>
              <TableHead className={tableHeaderCell}>Billing</TableHead>
              <TableHead className={tableHeaderCell}>Signed up</TableHead>
              <TableHead className={tableHeaderCell}>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {visibleUsers.map((user) => (
                <TableRow key={user.clerkUserId}>
                  <TableCell className={cn(tableBodyCell, "max-w-[22rem]")}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate">
                        {user.email ?? user.clerkUserId}
                      </span>
                      {user.admin ? (
                        <span className={cn(adminModeTag, "shrink-0")}>ADMIN</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "capitalize")}>
                    {user.plan}
                    {user.founding ? " · founding" : ""}
                  </TableCell>
                  <TableCell className={cn(tableBodyCell, "capitalize")}>
                    {adminBillingStatusLabel(user)}
                  </TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDate(user.createdAt)}</TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDateTime(user.updatedAt)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
        )}
      </AdminSection>

      <AdminSection title="Waitlist">
        {waitlist.length === 0 ? (
          <EmptyState
            compact
            icon={Users}
            title="No waitlist signups yet"
            description="Confirmed and unsubscribed rows appear here once people join."
          />
        ) : (
        <AdminTableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={tableHeaderCell}>Email</TableHead>
              <TableHead className={tableHeaderCell}>Signed up</TableHead>
              <TableHead className={tableHeaderCell}>Confirmed</TableHead>
              <TableHead className={tableHeaderCell}>Unsubscribed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {waitlist.map((row) => (
                <TableRow key={row.email}>
                  <TableCell className={cn(tableBodyCell, "max-w-[18rem] truncate")}>{row.email}</TableCell>
                  <TableCell className={tableBodyCell}>{formatAdminDateTime(row.createdAt)}</TableCell>
                  <TableCell className={tableBodyCell}>
                    {row.confirmedAt ? formatAdminDateTime(row.confirmedAt) : "—"}
                  </TableCell>
                  <TableCell className={tableBodyCell}>
                    {row.unsubscribedAt ? formatAdminDateTime(row.unsubscribedAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        </AdminTableFrame>
        )}
      </AdminSection>
    </AdminPage>
  );
}
