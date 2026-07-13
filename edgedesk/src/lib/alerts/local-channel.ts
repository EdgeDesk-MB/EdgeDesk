"use client";

/**
 * Local delivery channel (C4 v1): browser Notification when permission is
 * granted, sonner toast otherwise - alerts always land somewhere. Phase 4
 * swaps in a push-backed channel behind the same interface.
 */

import { toast } from "sonner";
import type { AlertChannel } from "./types";

export function createLocalAlertChannel(): AlertChannel {
  return {
    notify(alert) {
      const canNotify =
        typeof Notification !== "undefined" && Notification.permission === "granted";

      if (canNotify) {
        const n = new Notification(alert.title, {
          body: alert.body,
          icon: "/icon-192.png",
          tag: alert.key,
        });
        n.onclick = () => {
          window.focus();
          window.location.assign(alert.href);
          n.close();
        };
        return;
      }

      toast.info(alert.title, {
        description: alert.body,
        action: {
          label: "Open",
          onClick: () => window.location.assign(alert.href),
        },
      });
    },
  };
}
