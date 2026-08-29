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
import { AdminAccountFilters } from "@/components/admin/admin-account-filters";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { OnboardingAnswersTable } from "@/components/admin/onboarding-answers-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { loadAdminAccountScope } from "@/lib/admin/exclude-accounts-server";
import {
  emailsOfExcludedAccounts,
  hiddenAccountsSub,
  scopeAdminUsers,
  withoutExcludedEmails,
} from "@/lib/admin/exclude-accounts";
import { buildAccountGrowth } from "@/lib/admin/growth";
import {
  buildAttributionShare,
  buildExperienceShare,
  buildOnboardingAnswerRows,
  buildOnboardingCompletion,
  buildWaitlistFunnel,
  buildWhyHereShare,
} from "@/lib/admin/funnel";
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
  const [users, waitlist, scope] = await Promise.all([
    listAppUsers(),
    listWaitlistSignups(200),
    loadAdminAccountScope(),
  ]);
  const { excludeAdmins, excludedIds } = scope;
  const admins = users.filter((user) => user.admin).length;
  const visibleUsers = scopeAdminUsers(users, { excludeAdmins, excludedIds });
  const excludedEmails = emailsOfExcludedAccounts(users, excludedIds);
  const visibleWaitlist = withoutExcludedEmails(waitlist, excludedEmails);
  const waitlistEmails = new Set(visibleWaitlist.map((row) => row.email.toLowerCase()));
  const waitlistToPaid = visibleUsers.filter(
    (user) =>
      user.email &&
      waitlistEmails.has(user.email.toLowerCase()) &&
      (user.plan === "core" || user.plan === "edge")
  ).length;
  const confirmed = visibleWaitlist.filter((row) => row.confirmedAt && !row.unsubscribedAt).length;
  const growth = buildAccountGrowth(visibleUsers, visibleWaitlist);
  const leaving = buildLeavingRows(visibleUsers);
  const funnel = buildWaitlistFunnel(visibleWaitlist, visibleUsers);
  const attributionShare = buildAttributionShare(visibleUsers);
  const onboarding = buildOnboardingCompletion(visibleUsers);
  const experienceShare = buildExperienceShare(visibleUsers);
  const whyHereShare = buildWhyHereShare(visibleUsers);
  const onboardingAnswers = buildOnboardingAnswerRows(visibleUsers);

  return (
    <AdminPage
      title="Subscribers"
      description="Plans, waitlist and last active."
      icon={Users}
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
          value={String(visibleUsers.length)}
          sub={hiddenAccountsSub(admins, excludeAdmins, excludedIds.length)}
        />
        <StatTile
          label="Core + Edge"
          value={String(visibleUsers.filter((u) => u.plan === "core" || u.plan === "edge").length)}
        />
        <StatTile label="Waitlist" value={String(visibleWaitlist.length)} sub={`${confirmed} confirmed`} />
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

      <AdminSection
        title="Onboarding"
        description="Answers saved when someone finishes the hosted onboarding questions, newest first. Open a row to replay their screens. The Help tour is device-local and does not appear here."
      >
        <div className="flex flex-col gap-4">
          <StatStrip columns={3}>
            <StatTile
              label="Answered"
              value={String(onboarding.answered)}
              sub={`${onboarding.total} account${onboarding.total === 1 ? "" : "s"}`}
            />
            <StatTile label="Not yet" value={String(onboarding.pending)} />
            <StatTile
              label="Completion"
              value={
                onboarding.total === 0
                  ? "—"
                  : `${Math.round((onboarding.answered / onboarding.total) * 100)}%`
              }
            />
          </StatStrip>
          <AdminChartGrid>
            <AdminChartCard
              title="Experience"
              description="What they said their matched-betting background was."
            >
              <AdminDonutChart
                slices={experienceShare}
                label="Experience"
                emptyTitle="No onboarding answers yet"
                emptyDescription="Experience mix appears here after someone finishes onboarding."
              />
            </AdminChartCard>
            <AdminChartCard
              title="How they heard"
              description="Onboarding attribution across accounts that answered. Skipped and blank left out."
            >
              <AdminDonutChart
                slices={attributionShare}
                label="How they heard"
                emptyTitle="No onboarding answers yet"
                emptyDescription="Attribution appears here after someone finishes onboarding."
              />
            </AdminChartCard>
          </AdminChartGrid>
          <AdminChartCard
            title="Why they are here"
            description="Features they picked during onboarding. People can choose more than one, so counts can exceed answered accounts."
          >
            <AdminShareBars
              slices={whyHereShare}
              emptyTitle="No onboarding answers yet"
              emptyDescription="Feature picks appear here after someone finishes onboarding."
            />
          </AdminChartCard>
          {onboardingAnswers.length === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title="Nobody has finished onboarding yet"
              description="Answers land here when an account completes the onboarding questions."
            />
          ) : (
            <AdminTableFrame>
              <OnboardingAnswersTable rows={onboardingAnswers} />
            </AdminTableFrame>
          )}
        </div>
      </AdminSection>

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
                : "Turn off Exclude admins, or include test accounts, to see more."
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
        {visibleWaitlist.length === 0 ? (
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
              {visibleWaitlist.map((row) => (
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
