"use client";

/**
 * Polls for due user reminders and delivers them through the local alert
 * channel (toast / Notification). Server-side fire on /api/state also writes
 * the inbox + push; this covers the open-tab case without waiting for a visit
 * to Alerts.
 */

import { useEffect, useMemo, useRef } from "react";
import { createLocalAlertChannel } from "@/lib/alerts/local-channel";
import type { EdgeAlert } from "@/lib/alerts/types";
import { api } from "@/hooks/use-app-state";

const POLL_MS = 30_000;

export function UserReminderListener() {
  const channel = useMemo(() => createLocalAlertChannel(), []);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function pulse() {
      try {
        const res = await api<{ fired: EdgeAlert[] }>("/api/reminders");
        if (cancelled) return;
        for (const alert of res.fired ?? []) {
          if (!alert.key || seenRef.current.has(alert.key)) continue;
          seenRef.current.add(alert.key);
          channel.notify({
            key: alert.key,
            kind: "user_reminder",
            title: alert.title,
            body: alert.body ?? "",
            href: alert.href ?? "/alerts",
          });
        }
      } catch {
        /* server offline - try again next tick */
      }
    }

    void pulse();
    const id = window.setInterval(() => void pulse(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [channel]);

  return null;
}
