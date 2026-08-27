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
import { InboxReportsTable } from "@/components/admin/inbox-reports-table";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { buildInboxCharts } from "@/lib/admin/inbox-charts";
import { listFeedbackReports } from "@/lib/feedback/inbox-store";

export default async function AdminInboxPage() {
  const reports = await listFeedbackReports(100);
  const unfiled = reports.filter((report) => !report.linearIssueId);
  const charts = buildInboxCharts(reports);

  return (
    <AdminPage
      title="Inbox"
      description="Feedback reports from the desk. Filing to Linear stays in the triage loop."
      icon={Inbox}
    >
      <StatStrip columns={3}>
        <StatTile label="Reports" value={String(reports.length)} sub="Last 100" />
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
        {reports.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No feedback yet"
            description="Reports from the in-app feedback form will show here."
          />
        ) : (
          <AdminTableFrame>
            <InboxReportsTable reports={reports} />
          </AdminTableFrame>
        )}
      </AdminSection>
    </AdminPage>
  );
}
