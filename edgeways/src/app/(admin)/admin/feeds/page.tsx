import { AlertTriangle, Radio } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { FeedCapsForm } from "@/components/admin/feed-caps-form";
import { FeedUsageChart } from "@/components/admin/feed-usage-chart";
import { FeedsPanel } from "@/components/admin/feeds-panel";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadFeedMonitor, loadFeedStatus, type FeedMonitorLane } from "@/lib/admin/feeds";
import { readAllFeedHeartbeats } from "@/lib/admin/feed-heartbeat";
import {
  FEED_STATE_DESCRIPTION,
  FEED_STATE_LABEL,
  type FeedThresholdState,
} from "@/lib/admin/feed-monitor";
import { formatClockTime } from "@/lib/time-format";
import { cn } from "@/lib/utils";

const STATE_VALUE_CLASS: Record<FeedThresholdState, string> = {
  ok: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

const STATE_BADGE_VARIANT: Record<FeedThresholdState, "default" | "outline" | "destructive"> = {
  ok: "outline",
  warning: "default",
  critical: "destructive",
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
  const [status, monitor, heartbeats] = await Promise.all([
    loadFeedStatus(),
    loadFeedMonitor(),
    readAllFeedHeartbeats(),
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
      title="Feed health"
      description="Operator-held football, racing and exchange feeds. Customers do not add keys."
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
        <Card
          className={cn(
            "border-warning/60 bg-warning/5",
            alerts.some(([, lane]) => lane.state === "critical") &&
              "border-destructive/60 bg-destructive/5"
          )}
        >
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div className="flex flex-col gap-1">
              {alerts.map(([name, lane]) => (
                <p key={name} className="text-sm">
                  <span className="font-semibold">{name}:</span>{" "}
                  {FEED_STATE_DESCRIPTION[lane.state]}{" "}
                  {lane.capReachedAt != null && lane.used < lane.cap && (
                    <span className="text-muted-foreground">
                      At the current pace the cap is reached around{" "}
                      {formatClockTime(lane.capReachedAt)}.
                    </span>
                  )}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Football usage</CardTitle>
              <Badge variant={STATE_BADGE_VARIANT[monitor.football.state]}>
                {FEED_STATE_LABEL[monitor.football.state]}
              </Badge>
            </div>
            <CardDescription>
              Daily API requests across all desks — one poll serves every user
              tracking the same match.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedUsageChart
              label="Football"
              history={monitor.football.history}
              cap={monitor.football.cap}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Racing usage</CardTitle>
              <Badge variant={STATE_BADGE_VARIANT[monitor.racing.state]}>
                {FEED_STATE_LABEL[monitor.racing.state]}
              </Badge>
            </div>
            <CardDescription>
              Daily requests across all desks. The provider limit is per-second;
              this threshold is for spotting growth early.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FeedUsageChart
              label="Racing"
              history={monitor.racing.history}
              cap={monitor.racing.cap}
            />
          </CardContent>
        </Card>
      </div>

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

      <FeedCapsForm initial={monitor.caps} />

      <FeedsPanel initial={status} heartbeats={heartbeats} />
    </AdminPage>
  );
}
