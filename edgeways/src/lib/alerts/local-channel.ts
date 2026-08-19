"use client";

/**
 * Local delivery channel (C4 v1): EdgeAlerts land as in-app toasts.
 * - sticky (default): OnEvent / automation - stays until dismissed, close control.
 * - ephemeral: user just took the action - auto-closes, no close icon, no OS notify.
 * Uses the default (popover) toast face, not Sonner's richColors info blue, with a
 * brand accent rail. Bookie names render as VenueBadge (same as offers).
 *
 * Sticky toasts track raisedAt for an age footer, refresh countdown copy in place,
 * and auto-dismiss after long idle / tab-hidden stretches.
 */

import { createElement } from "react";
import { toast } from "sonner";
import { EdgeAlertToastDescription } from "@/components/alerts/edge-alert-toast-description";
import { EdgeAlertToastTitle } from "@/components/alerts/edge-alert-toast-title";
import {
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
} from "@/lib/alerts/notification-icons";
import { ensureNotificationTitleEmoji } from "@/lib/alerts/notification-title";
import { plainAlertBody } from "@/lib/alerts/plain-body";
import {
  ALERT_TOAST_AGE_TICK_MS,
  ALERT_TOAST_HIDDEN_DISMISS_MS,
  ALERT_TOAST_STALE_DISMISS_MS,
} from "@/lib/alerts/toast-age";
import { emitAlertInboxRead } from "@/lib/alerts/inbox-read-event";
import { dismissBrowserNotifications } from "@/lib/alerts/seen";
import { clearApiGetCache } from "@/lib/api-get-cache";
import { announceAlertDocumentTitle, dismissAlertDocumentTitle } from "@/lib/document-title";
import { cn } from "@/lib/utils";
import type { AlertChannel, EdgeAlert } from "./types";

/** Sonner default; keep user-action feedback brief. */
export const EPHEMERAL_ALERT_TOAST_MS = 4000;

type StickyToastMeta = {
  raisedAt: number;
  title: string;
  body: string;
};

const stickyToastMeta = new Map<string, StickyToastMeta>();
/** Programmatic toast.dismiss must not mark the inbox read (idle / hidden / cleared). */
const skipInboxReadOnDismiss = new Set<string>();

let lifecycleStarted = false;
let hiddenAt: number | null = null;
let staleTimer: ReturnType<typeof setInterval> | null = null;

function edgeAlertToastClassName(alert: EdgeAlert): string {
  return cn(
    "edge-alert-toast",
    alert.tone === "positive" && "edge-alert-toast--positive",
    alert.tone === "negative" && "edge-alert-toast--negative"
  );
}

/** Toast options for EdgeAlerts - sticky for automation, ephemeral for user actions. */
export function edgeAlertToastOptions(
  alert: EdgeAlert,
  raisedAt: number = Date.now()
) {
  const toastClass = edgeAlertToastClassName(alert);
  const ephemeral = alert.delivery === "ephemeral";
  return {
    id: alert.key,
    description: ephemeral
      ? alert.body || undefined
      : createElement(EdgeAlertToastDescription, {
          body: alert.body,
          raisedAt,
        }),
    duration: ephemeral ? EPHEMERAL_ALERT_TOAST_MS : Number.POSITIVE_INFINITY,
    closeButton: ephemeral ? (false as const) : (true as const),
    // No action / Open CTA - deep links live in the alerts inbox and OS shade.
    action: undefined,
    className: toastClass,
    classNames: {
      toast: toastClass,
      title: "edge-alert-toast-title",
      description: "edge-alert-toast-description",
      ...(ephemeral ? {} : { closeButton: "edge-alert-toast-close" }),
    },
    onDismiss: () => {
      stickyToastMeta.delete(alert.key);
      if (!ephemeral) persistUserDismissIfNeeded(alert.key);
    },
    onAutoClose: () => {
      stickyToastMeta.delete(alert.key);
      if (!ephemeral) persistUserDismissIfNeeded(alert.key);
    },
  };
}

function showEdgeAlertToast(alert: EdgeAlert, raisedAt: number): void {
  // Do not toast.dismiss(id) immediately before create - Sonner queues that
  // dismiss on rAF and it removes the toast you just added (looks like a no-op).
  // Same-id notify updates in place via sonner's create().
  toast(
    createElement(EdgeAlertToastTitle, {
      title: alert.title,
      tone: alert.tone,
      bookmaker: alert.bookmaker,
    }),
    edgeAlertToastOptions(alert, raisedAt)
  );
}

function skipInboxRead(keys: Iterable<string>): void {
  for (const key of keys) {
    if (key) skipInboxReadOnDismiss.add(key);
  }
}

function persistUserDismissIfNeeded(key: string): void {
  if (skipInboxReadOnDismiss.delete(key)) return;
  persistAlertDismissed(key);
}

/** Drop sticky EdgeAlert toasts that have been on-screen too long. */
export function dismissStaleStickyAlertToasts(now: number = Date.now()): void {
  for (const [key, meta] of stickyToastMeta) {
    if (now - meta.raisedAt < ALERT_TOAST_STALE_DISMISS_MS) continue;
    skipInboxRead([key]);
    toast.dismiss(key);
    stickyToastMeta.delete(key);
  }
}

/** Dismiss every tracked sticky EdgeAlert toast (e.g. long tab-hidden return). */
export function dismissAllStickyAlertToasts(): void {
  const keys = [...stickyToastMeta.keys()];
  skipInboxRead(keys);
  for (const key of keys) {
    toast.dismiss(key);
  }
  stickyToastMeta.clear();
}

/** Wipe every Sonner toast, including ones whose meta was lost on HMR. */
export function dismissEveryVisibleAlertToast(): void {
  skipInboxRead(stickyToastMeta.keys());
  toast.dismiss();
  stickyToastMeta.clear();
}

/** Mark a user-dismissed sticky toast read in the desk inbox. */
export function persistAlertDismissed(key: string): void {
  const dedupe = key.trim();
  if (!dedupe) return;
  dismissAlertDocumentTitle(dedupe);
  void dismissBrowserNotifications([dedupe]);
  void fetch("/api/alerts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dedupe, read: true }),
  })
    .then((res) => {
      if (!res.ok) return;
      clearApiGetCache();
      emitAlertInboxRead(dedupe);
    })
    .catch(() => {});
}

/** Dismiss specific sticky toasts (condition cleared). */
export function dismissStickyAlertToasts(keys: string[]): void {
  skipInboxRead(keys);
  for (const key of keys) {
    if (!key) continue;
    toast.dismiss(key);
    stickyToastMeta.delete(key);
  }
}

/**
 * Visibility + age lifecycle for sticky EdgeAlert toasts. Safe to call often;
 * listeners are registered once.
 */
export function ensureAlertToastLifecycle(): void {
  if (typeof window === "undefined" || lifecycleStarted) return;
  lifecycleStarted = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (
      hiddenAt != null &&
      Date.now() - hiddenAt >= ALERT_TOAST_HIDDEN_DISMISS_MS
    ) {
      dismissAllStickyAlertToasts();
    }
    hiddenAt = null;
  });

  staleTimer = setInterval(() => {
    dismissStaleStickyAlertToasts();
  }, ALERT_TOAST_AGE_TICK_MS);
  void staleTimer;
}

/** Test helper - reset module state between vitest cases. */
export function resetAlertToastChannelForTests(): void {
  stickyToastMeta.clear();
  skipInboxReadOnDismiss.clear();
  hiddenAt = null;
  lifecycleStarted = false;
  if (staleTimer != null) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
}

export function createLocalAlertChannel(): AlertChannel {
  return {
    notify(alert) {
      const ephemeral = alert.delivery === "ephemeral";
      const canNotify =
        !ephemeral &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted";

      const raisedAt = ephemeral
        ? Date.now()
        : (stickyToastMeta.get(alert.key)?.raisedAt ?? Date.now());
      if (!ephemeral) {
        stickyToastMeta.set(alert.key, {
          raisedAt,
          title: alert.title,
          body: alert.body,
        });
      }

      // Default toast (not toast.info) so richColors cannot paint it blue.
      showEdgeAlertToast(alert, raisedAt);
      // Tab title mirrors push copy (emoji title), not toast JSX.
      announceAlertDocumentTitle(alert);

      // User-action feedback stays in-tab only - no OS / service-worker notify.
      if (!canNotify) return;

      const osTitle = ensureNotificationTitleEmoji(alert.title);
      const osBody = plainAlertBody(alert);

      // Android Chrome forbids page-context `new Notification` ("Illegal
      // constructor") - notifications must go via the service worker, whose
      // notificationclick handler (F3) opens the deep link.
      const showPageNotification = (): boolean => {
        try {
          const n = new Notification(osTitle, {
            body: osBody,
            icon: NOTIFICATION_ICON,
            badge: NOTIFICATION_BADGE,
            tag: alert.key,
          });
          n.onclick = () => {
            window.focus();
            window.location.assign(alert.href);
            n.close();
          };
          return true;
        } catch {
          return false;
        }
      };

      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
          .getRegistration()
          .then((reg) => {
            if (!reg) throw new Error("no service worker registration");
            return reg.showNotification(osTitle, {
              body: osBody,
              icon: NOTIFICATION_ICON,
              badge: NOTIFICATION_BADGE,
              tag: alert.key,
              data: { href: alert.href },
            });
          })
          .catch(() => {
            void showPageNotification();
          });
        return;
      }
      void showPageNotification();
    },

    refresh(alert) {
      // Only refresh toasts the user has not dismissed.
      const meta = stickyToastMeta.get(alert.key);
      if (!meta) return;
      if (meta.title === alert.title && meta.body === alert.body) return;

      stickyToastMeta.set(alert.key, {
        raisedAt: meta.raisedAt,
        title: alert.title,
        body: alert.body,
      });
      showEdgeAlertToast(
        { ...alert, delivery: "sticky" },
        meta.raisedAt
      );
    },

    dismiss(keys) {
      dismissStickyAlertToasts(keys);
    },
  };
}
