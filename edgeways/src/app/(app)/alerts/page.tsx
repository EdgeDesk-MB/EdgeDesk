"use client";

/**
 * Alerts inbox (F2) - the persistent record of every emitted alert. Toasts
 * and notifications deliver; nothing is lost if you miss one. Tapping a row
 * marks it read and follows its deep link.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListDaySection } from "@/components/layout/list-day-section";
import {
  AlarmClock,
  Ban,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  CircleCheck,
  Flag,
  Gift,
  ListChecks,
  ShieldAlert,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/help/empty-state";
import { PageLoading } from "@/components/page-loading";
import { PageHeader } from "@/components/help/page-header";
import { PageFillScroll, PageFillShell } from "@/components/page-shell";
import { api, apiGet, useAppState } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import { groupAlertsInboxByDay } from "@/lib/alerts/inbox-day-groups";
import { ALERT_INBOX_READ_EVENT } from "@/lib/alerts/inbox-read-event";
import type { AlertsInboxRow } from "@/lib/db/schema";
import { formatClockTime } from "@/lib/time-format";
import { listDaySectionContentCompact } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, LucideIcon> = {
  offer_expiring: AlarmClock,
  free_bet_expiring: Gift,
  race_off_soon: Timer,
  result_settled: CircleCheck,
  acca_complete: CircleCheck,
  acca_refund: Gift,
  acca_next_lay: AlarmClock,
  naked_exposure: ShieldAlert,
  two_up_lock: Flag,
  user_reminder: Bell,
  daily_tasks: ListChecks,
  weekly_digest: Bell,
};

export default function AlertsPage() {
  const router = useRouter();
  // Shared polled context - refresh() keeps the nav unread badge in step.
  const { refresh } = useAppState();
  const now = useNow(60_000);
  const [alerts, setAlerts] = useState<AlertsInboxRow[] | null>(null);

  const load = useCallback(() => {
    apiGet<{ alerts: AlertsInboxRow[] }>("/api/alerts")
      .then((r) => setAlerts(r.alerts))
      .catch(() => setAlerts([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onInboxRead = () => load();
    window.addEventListener(ALERT_INBOX_READ_EVENT, onInboxRead);
    return () => window.removeEventListener(ALERT_INBOX_READ_EVENT, onInboxRead);
  }, [load]);

  const unread = (alerts ?? []).filter((a) => a.readAt == null).length;

  async function open(alert: AlertsInboxRow) {
    if (alert.readAt == null) {
      await api("/api/alerts", { method: "PATCH", json: { id: alert.id, read: true } }).catch(
        () => {}
      );
      void refresh();
    }
    if (alert.href) router.push(alert.href);
    else load();
  }

  async function readAll() {
    await api("/api/alerts", { method: "PATCH", json: { all: true, read: true } }).catch(() => {});
    void refresh();
    load();
  }

  /** Mark a single alert read in place - no navigation, unlike open(). */
  async function markOneRead(alert: AlertsInboxRow) {
    await api("/api/alerts", { method: "PATCH", json: { id: alert.id, read: true } }).catch(
      () => {}
    );
    void refresh();
    load();
  }

  if (alerts == null) {
    return <PageLoading label="Loading alerts" />;
  }

  return (
    <PageFillShell>
      <PageHeader
        title="Alerts"
        rule={false}
        toolbarRule={false}
        description="Every alert we have raised."
        icon={BellRing}
        toolbar={
          unread > 0 ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={readAll}>
              <CheckCheck className="size-3.5" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <PageFillScroll>
      <div className="flex flex-col gap-8">
        {alerts.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No alerts yet"
            description="When a sentinel fires or an offer needs you, it lands here as well as on your screen, so a missed notification is never a lost one."
          />
        ) : (
          groupAlertsInboxByDay(alerts, now).map((group) => (
            <ListDaySection
              key={group.key}
              label={group.label}
              headingId={`alerts-day-${group.key}`}
              contentClassName={cn(listDaySectionContentCompact, "gap-2")}
            >
            {group.alerts.map((alert) => {
            const voided =
              (alert.kind === "result_settled" &&
                (alert.title.startsWith("Void ·") || alert.title.startsWith("Push ·"))) ||
              (alert.kind === "acca_complete" && alert.title.startsWith("Acca void"));
            const Icon = voided ? Ban : (KIND_ICONS[alert.kind] ?? BellRing);
            const isUnread = alert.readAt == null;
            return (
              <div
                key={alert.id}
                role="button"
                tabIndex={0}
                onClick={() => void open(alert)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void open(alert);
                  }
                }}
                className={cn(
                  "flex items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors hover:bg-selection-subtle",
                  isUnread ? "bg-card" : "opacity-70"
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    voided
                      ? "text-muted-foreground"
                      : isUnread
                        ? "text-primary-text"
                        : "text-muted-foreground"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm",
                      voided ? "font-medium text-muted-foreground" : isUnread ? "font-semibold" : "font-medium"
                    )}
                  >
                    {alert.title}
                  </span>
                  {alert.body ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {alert.body}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatClockTime(alert.updatedAt)}
                  </span>
                  {isUnread ? (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      title="Mark as read"
                      onClick={(e) => {
                        e.stopPropagation();
                        void markOneRead(alert);
                      }}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary-text"
                    >
                      <Check className="size-3.5" />
                      <span className="sr-only">Mark as read</span>
                    </button>
                  ) : null}
                </span>
              </div>
            );
            })}
            </ListDaySection>
          ))
        )}
      </div>
      </PageFillScroll>
    </PageFillShell>
  );
}
