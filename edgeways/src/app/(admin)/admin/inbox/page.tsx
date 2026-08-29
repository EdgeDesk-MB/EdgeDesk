import { Inbox } from "lucide-react";
import {
  AdminBarChart,
  AdminChartCard,
  AdminChartGrid,
  AdminCompareStrip,
  AdminDonutChart,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { ExcludedAccountsLink } from "@/components/admin/excluded-accounts-link";
import { InboxReportsTable } from "@/components/admin/inbox-reports-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { buildInboxCharts } from "@/lib/admin/inbox-charts";
import {
  emailsOfExcludedAccounts,
  withoutExcludedFeedback,
} from "@/lib/admin/exclude-accounts";
import { readExcludedAccountIds } from "@/lib/admin/exclude-accounts-server";
import { listFeedbackReports } from "@/lib/feedback/inbox-store";
import { listAppUsers } from "@/lib/services/app-users";

export default async function AdminInboxPage() {
  const [reports, users, excludedIds] = await Promise.all([
    listFeedbackReports(100),
    listAppUsers(),
    readExcludedAccountIds(),
  ]);
  const visibleReports = withoutExcludedFeedback(
    reports,
    emailsOfExcludedAccounts(users, excludedIds)
  );
  const unfiled = visibleReports.filter((report) => !report.linearIssueId);
  const charts = buildInboxCharts(visibleReports);

  return (
    <AdminPage
      title="Inbox"
      description="Feedback from the desk."
      icon={Inbox}
      toolbar={
        excludedIds.length > 0 ? (
          <ExcludedAccountsLink count={excludedIds.length} />
        ) : undefined
      }
    >
      <StatStrip columns={3}>
        <StatTile
          label="Reports"
          value={String(visibleReports.length)}
          sub="Last 100"
        />
        <StatTile
          label="Unfiled"
          value={String(unfiled.length)}
          sub={unfiled.length > 0 ? "Needs triage" : "All filed"}
        />
        <StatTile
          label="This week"
          value={String(charts.week.submissions.current)}
          sub="New reports"
        />
      </StatStrip>

      <AdminCompareStrip
        heading="Versus last week"
        items={[
          { label: "Reports", compare: charts.week.submissions, period: "week" },
        ]}
      />

      <AdminChartGrid>
        <AdminChartCard
          title="Submissions"
          description="Feedback reports per UTC day. Quiet days stay on the chart."
        >
          <AdminBarChart series={charts.submissions30} label="Submissions" />
        </AdminChartCard>
        <AdminChartCard
          title="Kind mix"
          description="Bug, idea or other across the loaded reports."
        >
          <AdminDonutChart slices={charts.kindShare} label="Kind mix" />
        </AdminChartCard>
      </AdminChartGrid>

      <AdminSection title="Reports">
        {visibleReports.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={reports.length === 0 ? "No feedback yet" : "No customer reports"}
            description={
              reports.length === 0
                ? "Reports from the in-app feedback form will show here."
                : "Include test accounts on Users to see reports from those desks."
            }
          />
        ) : (
          <AdminTableFrame>
            <InboxReportsTable reports={visibleReports} />
          </AdminTableFrame>
        )}
      </AdminSection>
    </AdminPage>
  );
}
