"use client";

/**
 * Local delivery channel (C4 v1): browser Notification when permission is
 * granted, sonner toast otherwise - alerts always land somewhere. Phase 4
 * swaps in a push-backed channel behind the same interface.
 */

import { toast } from "sonner";
import {
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
} from "@/lib/alerts/notification-icons";
import type { AlertChannel } from "./types";

export function createLocalAlertChannel(): AlertChannel {
  return {
    notify(alert) {
      const canNotify =
        typeof Notification !== "undefined" && Notification.permission === "granted";

      const showToast = () =>
        toast.info(alert.title, {
          description: alert.body,
          action: {
            label: "Open",
            onClick: () => window.location.assign(alert.href),
          },
        });

      // Android Chrome forbids page-context `new Notification` ("Illegal
      // constructor") - notifications must go via the service worker, whose
      // notificationclick handler (F3) opens the deep link.
      const showPageNotification = (): boolean => {
        try {
          const n = new Notification(alert.title, {
            body: alert.body,
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

      if (canNotify) {
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              if (!reg) throw new Error("no service worker registration");
              return reg.showNotification(alert.title, {
                body: alert.body,
                icon: NOTIFICATION_ICON,
                badge: NOTIFICATION_BADGE,
                tag: alert.key,
                data: { href: alert.href },
              });
            })
            .catch(() => {
              if (!showPageNotification()) showToast();
            });
          return;
        }
        if (showPageNotification()) return;
      }

      showToast();
    },
  };
}
