"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  Dices,
  Gift,
  HeartPulse,
  Radio,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { AdminLiveSoundToggle } from "@/components/admin/admin-live-sound-toggle";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminSection } from "@/components/admin/admin-section";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { api } from "@/hooks/use-app-state";
import { formatAdminDateTime } from "@/lib/admin/format";
import {
  ADMIN_LIVE_LOG_CAP,
  type AdminLiveLogList,
  type AdminLiveLogRow,
} from "@/lib/admin/live-log-shared";
import { formatClockTime } from "@/lib/time-format";
import { listRow, listRowGroup, surfaceLift } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<string, LucideIcon> = {
  bet_created: CircleCheck,
  offer_created: Gift,
  casino_created: Dices,
  signup: UserPlus,
  feed_warning: Radio,
  feed_critical: Radio,
  health_error: HeartPulse,
};

type LogResponse = AdminLiveLogList & { pollMs?: number };

function dayLabel(ms: number): string {
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatClockTime(date);
  return formatAdminDateTime(ms);
}

function iconClass(row: AdminLiveLogRow, unread: boolean): string {
  if (!unread) return "text-muted-foreground";
  if (row.tone === "error") return "text-destructive";
  if (row.tone === "warning") return "text-warning";
  return "text-primary-text";
}

export function AdminLiveLog({
  initial,
  initialError = false,
}: {
  initial: AdminLiveLogList;
  initialError?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<AdminLiveLogList>(initial);
  const [error, setError] = useState(initialError);
  const [pollMs, setPollMs] = useState(5000);
  const [settled, setSettled] = useState(true);

  const load = useCallback(async () => {
    try {
      const next = await api<LogResponse>("/api/admin/live/log");
      setData({
        rows: next.rows,
        unread: next.unread,
        truncated: next.truncated,
      });
      if (typeof next.pollMs === "number" && next.pollMs >= 3000) {
        setPollMs(next.pollMs);
      }
      setError(false);
    } catch {
      setError(true);
    } finally {
      setSettled(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [load, pollMs]);

  async function open(row: AdminLiveLogRow) {
    if (row.readAt == null) {
      await api("/api/admin/live/log", {
        method: "PATCH",
        json: { id: row.id, read: true },
      }).catch(() => {});
    }
    router.push(row.href);
  }

  async function markOneRead(row: AdminLiveLogRow) {
    await api("/api/admin/live/log", {
      method: "PATCH",
      json: { id: row.id, read: true },
    }).catch(() => {});
    void load();
  }

  async function readAll() {
    await api("/api/admin/live/log", {
      method: "PATCH",
      json: { all: true, read: true },
    }).catch(() => {});
    void load();
  }

  const unread = data.unread;
  const empty = data.rows.length === 0;

  return (
    <AdminPage
      title="Live"
      description="Live alerts while Admin is open."
      icon={Bell}
      action={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <AdminLiveSoundToggle className="min-w-0" />
          {unread > 0 ? (
            <Button
              variant="outline"
              {...pageSecondaryButtonProps}
              className="gap-1.5"
              onClick={() => void readAll()}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          ) : null}
        </div>
      }
    >
      <StatStrip columns={2}>
        <StatTile
          label="Events"
          value={String(data.rows.length)}
          sub={data.truncated ? `Latest ${ADMIN_LIVE_LOG_CAP}` : "Newest first"}
        />
        <StatTile
          label="Unread"
          value={String(unread)}
          sub={unread > 0 ? "Still to open" : "All read"}
        />
      </StatStrip>

      <AdminSection
        title="Events"
        description={
          data.truncated
            ? `Showing the latest ${ADMIN_LIVE_LOG_CAP} events. Older rows drop off.`
            : undefined
        }
      >
        {!settled && empty ? (
          <EmptyState
            icon={Bell}
            busy
            title="Loading the live log"
            description="Fetching the latest bundled activity."
          />
        ) : error && empty ? (
          <EmptyState
            icon={Bell}
            title="Could not load the live log"
            description="Try again in a moment. Toasts still fire while Admin is open."
            action={{
              label: "Retry",
              onClick: () => {
                setSettled(false);
                void load();
              },
            }}
          />
        ) : empty ? (
          <EmptyState
            icon={Bell}
            title="No live events yet"
            description="When a desk places a bet, a feed warns, or health drops, it lands here as well as on the toast, so a missed notification is never a lost one."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {error ? (
              <p className="text-sm text-muted-foreground">
                Could not refresh. Showing the last loaded events.{" "}
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-sm font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Retry
                </button>
              </p>
            ) : null}
            <div className={cn(surfaceLift, "overflow-hidden rounded-lg")}>
              <div className={listRowGroup} role="list">
                {data.rows.map((row) => {
                  const Icon = KIND_ICONS[row.kind] ?? Bell;
                  const isUnread = row.readAt == null;
                  return (
                    <div
                      key={row.id}
                      role="listitem"
                      className={cn(listRow, "flex items-stretch")}
                    >
                      <button
                        type="button"
                        onClick={() => void open(row)}
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left",
                          "hover:bg-selection-subtle",
                          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
                        )}
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            iconClass(row, isUnread)
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-pretty break-words text-sm",
                              isUnread
                                ? "font-semibold"
                                : "font-medium text-muted-foreground"
                            )}
                          >
                            {row.title}
                          </span>
                          {row.body ? (
                            <span className="mt-0.5 block text-pretty break-words text-xs text-muted-foreground">
                              {row.body}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {dayLabel(row.updatedAt)}
                        </span>
                      </button>
                      {isUnread ? (
                        <button
                          type="button"
                          aria-label="Mark as read"
                          title="Mark as read"
                          onClick={() => void markOneRead(row)}
                          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-selection-subtle hover:text-primary-text focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
                        >
                          <Check className="size-3.5" />
                          <span className="sr-only">Mark as read</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
}
