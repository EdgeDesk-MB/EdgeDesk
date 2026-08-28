"use client";

/**
 * F3 - per-device web-push opt-in. Subscribing registers this browser with
 * the local server's VAPID keys; sentinel alerts then arrive with every
 * Edgeways tab closed. Requires the server to be running to send.
 *
 * Local Notification permission (toasts / shade while the app is open) is
 * NOT the same as a push subscription. Organic alerts can work while the
 * server still has no row for this device - we sync any local subscription
 * up on mount and offer a force re-register when they drift apart.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/hooks/use-app-state";
import { formatAlertHours, formatAlertMinutes } from "@/lib/alerts/toast-age";

type PushDevice = {
  id: number;
  label: string | null;
  createdAt: number;
  lastOkAt: number | null;
  endpointTail?: string;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad/i.test(ua)
      ? "iOS"
      : /Mac/i.test(ua)
        ? "Mac"
        : /Windows/i.test(ua)
          ? "Windows"
          : "Device";
  const browser = /Chrome/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Browser";
  return `${os} · ${browser}`;
}

function formatLastDelivered(ms: number | null): string {
  if (ms == null) return "Not delivered yet";
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return "Last delivered just now";
  if (mins < 60) return `Last delivered ${formatAlertMinutes(mins)} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Last delivered ${formatAlertHours(hours)} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Last delivered 1 day ago" : `Last delivered ${days} days ago`;
}

function subscriptionJson(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Browser returned an incomplete push subscription");
  }
  return { endpoint, keys: { p256dh, auth } };
}

export function PushDeviceControl() {
  const [secure, setSecure] = useState<boolean | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [localSub, setLocalSub] = useState(false);
  const [onServer, setOnServer] = useState(false);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [probeNote, setProbeNote] = useState<string | null>(null);
  // Guards double-taps before React re-renders `busy` (was stacking test pushes).
  const busyLock = useRef(false);

  const refreshDevices = useCallback(async (endpoint?: string | null) => {
    try {
      const r = await api<{ devices: PushDevice[] }>("/api/push");
      setDevices(r.devices);
      if (endpoint) {
        const tail = endpoint.slice(-16);
        setOnServer(r.devices.some((d) => d.endpointTail === tail));
      }
      return r.devices;
    } catch {
      return null;
    }
  }, []);

  const syncLocalToServer = useCallback(
    async (sub: PushSubscription): Promise<boolean> => {
      try {
        await api("/api/push", {
          method: "POST",
          json: { subscription: subscriptionJson(sub), label: deviceLabel() },
        });
        await refreshDevices(sub.endpoint);
        return true;
      } catch {
        setProbeNote("Could not save this device. Try the switch again.");
        return false;
      }
    },
    [refreshDevices]
  );

  useEffect(() => {
    const isSecure = window.isSecureContext;
    const ok =
      isSecure &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    queueMicrotask(() => {
      setSecure(isSecure);
      setSupported(ok);
      setPermission(typeof Notification !== "undefined" ? Notification.permission : "unknown");
      void refreshDevices();
    });
    if (!ok) return;

    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setLocalSub(sub != null);
        if (sub) {
          const synced = await syncLocalToServer(sub);
          if (!cancelled && synced) {
            setProbeNote(null);
          }
        } else {
          setOnServer(false);
        }
      } catch {
        if (!cancelled) setLocalSub(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDevices, syncLocalToServer]);

  async function ensurePushRegistration(): Promise<ServiceWorkerRegistration> {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    if (!reg.active) {
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("Service worker did not activate")),
          10_000
        );
        const done = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        const worker = reg.installing ?? reg.waiting;
        if (reg.active) {
          done();
          return;
        }
        if (!worker) {
          void navigator.serviceWorker.ready.then(() => done()).catch(reject);
          return;
        }
        worker.addEventListener("statechange", () => {
          if (worker.state === "activated" || reg.active) done();
        });
      });
    }
    return reg;
  }

  function withBusy<T>(fn: () => Promise<T>): Promise<T | void> {
    if (busyLock.current) return Promise.resolve();
    busyLock.current = true;
    setBusy(true);
    return fn().finally(() => {
      busyLock.current = false;
      setBusy(false);
    });
  }

  /** Fresh subscribe (drops any stale local sub that is not on the server). */
  async function registerPush(forceFresh: boolean) {
    return withBusy(async () => {
    setProbeNote(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notifications blocked", {
          description: "Allow notifications for this site, then try again.",
        });
        return;
      }
      const { publicKey } = await api<{ publicKey: string }>("/api/push");
      const reg = await ensurePushRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (forceFresh && sub) {
        await api("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } }).catch(
          () => {}
        );
        await sub.unsubscribe();
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      await api("/api/push", {
        method: "POST",
        json: { subscription: subscriptionJson(sub), label: deviceLabel() },
      });
      setLocalSub(true);
      await refreshDevices(sub.endpoint);
      toast.success(`Alerts on when Edgeways is closed (${deviceLabel()})`);
    } catch (e) {
      const msg = String(e);
      setProbeNote("Could not turn on alerts for this device. Try again.");
      toast.error("Could not turn on alerts for this device", { description: msg });
    }
    });
  }

  async function unsubscribe() {
    return withBusy(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } }).catch(
          () => {}
        );
        await sub.unsubscribe();
      }
      setLocalSub(false);
      setOnServer(false);
      await refreshDevices();
      toast.success("Alerts when closed turned off on this device");
    } catch (e) {
      toast.error("Could not turn off alerts for this device", { description: String(e) });
    }
    });
  }

  async function sendTest() {
    return withBusy(async () => {
    try {
      const res = await api<{
        sent: number;
        pruned: number;
        failed: number;
        failures?: { label: string | null; reason: string }[];
      }>("/api/push", {
        method: "POST",
        json: { test: true },
      });
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const list = (await refreshDevices(sub?.endpoint)) ?? devices;
      const names = list.map((d) => d.label ?? "Device").join(", ");
      if (res.sent > 0 && res.failed === 0 && res.pruned === 0) {
        toast.success(`Test sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`, {
          description: names || undefined,
        });
      } else if (res.sent > 0) {
        toast.warning(`Sent to ${res.sent}, ${res.pruned + res.failed} failed`, {
          description: (res.failures ?? [])
            .map((f) => `${f.label ?? "Device"}: ${f.reason}`)
            .join("; "),
        });
      } else if (res.pruned + res.failed > 0) {
        toast.error("Test failed on every device", {
          description:
            (res.failures ?? []).map((f) => `${f.label ?? "Device"}: ${f.reason}`).join("; ") ||
            "This device may need to re-register.",
        });
      } else {
        toast.info("No devices registered yet", {
          description: "Turn on When Edgeways is closed on this phone first.",
        });
      }
    } catch (e) {
      toast.error("Test failed", { description: String(e) });
    }
    });
  }

  const titleBlock = (
    <div className="min-w-0">
      <p className="text-sm font-medium text-pretty break-words">When Edgeways is closed</p>
      <p className="text-xs text-muted-foreground text-pretty break-words">
        Same alerts on this phone or computer with every tab closed. Turn on once
        per device.
      </p>
    </div>
  );

  if (secure == null || supported == null) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border px-3 py-2">
        {titleBlock}
        <Switch checked={false} disabled aria-label="Get alerts when Edgeways is closed" />
      </div>
    );
  }

  const deviceList =
    devices.length > 0 ? (
      <ul className="flex min-w-0 flex-col gap-1 border-t pt-2">
        {devices.map((d) => (
          <li
            key={d.id}
            className="flex min-w-0 items-baseline justify-between gap-2 text-xs text-muted-foreground"
          >
            <span className="min-w-0 font-medium text-pretty break-words text-foreground">
              {d.label ?? "Device"}
            </span>
            <span className="shrink-0">{formatLastDelivered(d.lastOkAt)}</span>
          </li>
        ))}
      </ul>
    ) : null;

  if (!secure) {
    return (
      <div className="flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2">
        <p className="text-sm font-medium text-pretty break-words">When Edgeways is closed</p>
        <p className="text-xs text-muted-foreground text-pretty break-words">
          Background alerts need a secure connection (HTTPS). In-app alerts still
          show while Edgeways is open.
        </p>
        {deviceList}
        <Link
          href="/help?guide=mobile"
          className="self-start text-xs text-primary-text underline-offset-2 hover:underline"
        >
          On your phone
        </Link>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2">
        <p className="text-sm font-medium text-pretty break-words">When Edgeways is closed</p>
        <p className="text-xs text-muted-foreground text-pretty break-words">
          This browser cannot receive alerts when Edgeways is closed. Use Chrome, not
          an in-app browser.
        </p>
        {deviceList}
      </div>
    );
  }

  const registered = localSub && onServer;
  const desynced = localSub && !onServer;
  const phoneMissing =
    devices.length > 0 && !devices.some((d) => /android|ios|iphone|ipad/i.test(d.label ?? ""));

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        {titleBlock}
        <Switch
          checked={registered}
          disabled={busy}
          aria-label="Get alerts when Edgeways is closed"
          onCheckedChange={(v) => void (v ? registerPush(desynced) : unsubscribe())}
        />
      </div>

      {permission === "denied" ? (
        <p className="text-xs text-warning text-pretty break-words">
          Notifications are blocked in this browser. Allow them in site settings, then
          try again.
        </p>
      ) : null}

      {desynced ? (
        <p className="text-xs text-warning text-pretty break-words">
          This device dropped off the list. Turn the switch on to register it again.
        </p>
      ) : null}

      {!registered && !desynced && devices.length > 0 ? (
        <p className="text-xs text-muted-foreground text-pretty break-words">
          Not on for this browser yet. Turn the switch on to add it.
        </p>
      ) : null}

      {probeNote ? (
        <p className="text-xs text-destructive text-pretty break-words">{probeNote}</p>
      ) : null}

      {deviceList}

      {phoneMissing && !registered ? (
        <p className="text-xs text-muted-foreground text-pretty break-words">
          This list only has a computer so far. Open Settings → Alerts on your phone
          and turn it on there.{" "}
          <Link
            href="/help?guide=mobile"
            className="text-primary-text underline-offset-2 hover:underline"
          >
            On your phone
          </Link>
        </p>
      ) : null}

      {devices.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void sendTest()}
          >
            Send a test
          </Button>
        </div>
      ) : null}
    </div>
  );
}
