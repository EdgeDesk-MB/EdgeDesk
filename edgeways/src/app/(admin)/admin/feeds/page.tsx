import { Radio, Activity } from "lucide-react";
import {
  AdminChartCard,
  AdminChartGrid,
} from "@/components/admin/admin-charts";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminTableFrame } from "@/components/admin/admin-table";
import { FeedCapsForm } from "@/components/admin/feed-caps-form";
import { FeedUsageChart } from "@/components/admin/feed-usage-chart";
import { FeedsPanel } from "@/components/admin/feeds-panel";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { EmptyState } from "@/components/help/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WarningNotice } from "@/components/ui/warning-notice";
import {
  loadFeedAttribution,
  loadFeedMonitor,
  loadFeedStatus,
  type FeedMonitorLane,
} from "@/lib/admin/feeds";
import { readAllFeedHeartbeats } from "@/lib/admin/feed-heartbeat";
import {
  FEED_STATE_DESCRIPTION,
  FEED_STATE_LABEL,
  feedOperationLabel,
  type FeedThresholdState,
} from "@/lib/admin/feed-monitor";
import { formatClockTime } from "@/lib/time-format";
import { surfaceLift, tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const STATE_VALUE_CLASS: Record<FeedThresholdState, string> = {
  ok: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

function paceSub(lane: FeedMonitorLane): string {
  const parts = [`Cap ${lane.cap.toLocaleString("en-GB")}/day`];
  if (lane.projected > lane.used) {
    parts.push(`pace ~${lane.projected.toLocaleString("en-GB")}`);
  }
  if (lane.capReachedAt != null && lane.used < lane.cap) {
    parts.push(`cap ~${formatClockTime(lane.capReachedAt)}`);
  }
  return parts.join(" · ");
}

export default async function AdminFeedsPage() {
  const [status, monitor, heartbeats, attribution] = await Promise.all([
    loadFeedStatus(),
    loadFeedMonitor(),
    readAllFeedHeartbeats(),
    loadFeedAttribution(),
  ]);
  const exchangeOk = status.exchange.providers.filter((provider) => provider.ok).length;
  const alerts = (
    [
      ["Football", monitor.football],
      ["Racing", monitor.racing],
    ] as const
  ).filter(([, lane]) => lane.state !== "ok");

  return (
    <AdminPage
      title="Feeds"
      description="Operator-held football, racing and exchange. One feed serves every Edge desk. Customers do not add keys."
      icon={Radio}
    >
      <StatStrip columns={3}>
        <StatTile
          label="Football"
          value={
            status.football.configured ? (
              <span className={STATE_VALUE_CLASS[monitor.football.state]}>
                {monitor.football.used.toLocaleString("en-GB")}
                <span className="text-base font-medium text-muted-foreground">
                  /{monitor.football.cap.toLocaleString("en-GB")}
                </span>
              </span>
            ) : (
              "Off"
            )
          }
          sub={
            status.football.configured
              ? `${FEED_STATE_LABEL[monitor.football.state]} · ${paceSub(monitor.football)}`
              : "Requests today"
          }
        />
        <StatTile
          label="Racing"
          value={
            status.racing.configured ? (
              <span className={STATE_VALUE_CLASS[monitor.racing.state]}>
                {monitor.racing.used.toLocaleString("en-GB")}
                <span className="text-base font-medium text-muted-foreground">
                  /{monitor.racing.cap.toLocaleString("en-GB")}
                </span>
              </span>
            ) : (
              "Off"
            )
          }
          sub={
            status.racing.configured
              ? `${FEED_STATE_LABEL[monitor.racing.state]} · ${paceSub(monitor.racing)}`
              : "Requests today"
          }
        />
        <StatTile
          label="Exchange"
          value={`${exchangeOk} live`}
          sub={`${status.exchange.providers.length} provider${status.exchange.providers.length === 1 ? "" : "s"}`}
        />
      </StatStrip>

      {alerts.length > 0 && (
        <WarningNotice
          title={
            alerts.some(([, lane]) => lane.state === "critical")
              ? "Feed caps need an upgrade"
              : "Feed caps are on a watch"
          }
        >
          <div className="flex flex-col gap-1">
            {alerts.map(([name, lane]) => (
              <p key={name}>
                <span className="font-semibold text-foreground">{name}:</span>{" "}
                {FEED_STATE_DESCRIPTION[lane.state]}{" "}
                {lane.capReachedAt != null && lane.used < lane.cap && (
                  <span>
                    At the current pace the cap is reached around{" "}
                    {formatClockTime(lane.capReachedAt)}.
                  </span>
                )}
              </p>
            ))}
          </div>
        </WarningNotice>
      )}

      <AdminSection
        title="Usage"
        description="Daily API requests across all desks. One poll serves every user tracking the same match."
      >
        <AdminChartGrid>
          <AdminChartCard
            title="Football usage"
            description="Provider quota is per day. This ceiling is for spotting growth early."
          >
            <FeedUsageChart
              label="Football"
              history={monitor.football.history}
              cap={monitor.football.cap}
            />
          </AdminChartCard>

          <AdminChartCard
            title="Racing usage"
            description="The provider limit is per-second. This threshold is for spotting growth early."
          >
            <FeedUsageChart
              label="Racing"
              history={monitor.racing.history}
              cap={monitor.racing.cap}
            />
          </AdminChartCard>
        </AdminChartGrid>
      </AdminSection>

      {attribution.hosted && (
        <AdminSection
          title="Spend by source"
          description="Who and what is spending today's requests. Attribution began when this shipped, so today's rows can lag the counters above."
        >
          {attribution.sources.length === 0 ? (
            <EmptyState
              compact
              icon={Activity}
              title="No spend recorded yet today"
              description="Rows appear here as requests are attributed to a user or the system poller."
            />
          ) : (
            <AdminTableFrame>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={tableHeaderCell}>Source</TableHead>
                    <TableHead className={tableHeaderCell}>What they called</TableHead>
                    <TableHead className={cn(tableHeaderCell, "text-right")}>Football</TableHead>
                    <TableHead className={cn(tableHeaderCell, "text-right")}>Racing</TableHead>
                    <TableHead className={cn(tableHeaderCell, "text-right")}>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attribution.sources.map((source) => (
                    <TableRow key={source.key}>
                      <TableCell
                        className={cn(
                          tableBodyCell,
                          "max-w-[16rem] truncate font-medium",
                          source.isSystem && "text-muted-foreground"
                        )}
                        title={source.label}
                      >
                        {source.label}
                      </TableCell>
                      <TableCell className={cn(tableBodyCell, "min-w-0 text-muted-foreground")}>
                        {source.operations
                          .map(
                            (op) =>
                              `${feedOperationLabel(op.operation)} ×${op.count.toLocaleString("en-GB")}`
                          )
                          .join(" · ")}
                      </TableCell>
                      <TableCell className={cn(tableBodyCell, "text-right tabular-nums")}>
                        {source.football > 0 ? source.football.toLocaleString("en-GB") : "—"}
                      </TableCell>
                      <TableCell className={cn(tableBodyCell, "text-right tabular-nums")}>
                        {source.racing > 0 ? source.racing.toLocaleString("en-GB") : "—"}
                      </TableCell>
                      <TableCell className={cn(tableBodyCell, "text-right font-medium tabular-nums")}>
                        {source.total.toLocaleString("en-GB")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AdminTableFrame>
          )}
        </AdminSection>
      )}

      <AdminSection
        title="Football demand"
        description="What the poller is tracking right now, across every desk."
      >
        <StatStrip columns={2}>
          <StatTile
            label="Live matches now"
            value={monitor.demand.liveFootball.toLocaleString("en-GB")}
            sub="Distinct events the poller is polling"
          />
          <StatTile
            label="Matches still to start"
            value={monitor.demand.upcomingFootball.toLocaleString("en-GB")}
            sub="API-sourced, before end of day"
          />
        </StatStrip>
      </AdminSection>

      <AdminSection
        title="Daily caps"
        description="Raise these when you upgrade a provider plan. Both are hard ceilings, and requests stop for the day when a cap is hit."
      >
        <div className={cn(surfaceLift, "rounded-lg px-4 py-4")}>
          <FeedCapsForm initial={monitor.caps} />
        </div>
      </AdminSection>

      <AdminSection
        title="Connection tests"
        description="A passing test is the feed every Edge desk receives. If this fails, customers fall back to estimates."
      >
        <FeedsPanel initial={status} heartbeats={heartbeats} />
      </AdminSection>
    </AdminPage>
  );
}
