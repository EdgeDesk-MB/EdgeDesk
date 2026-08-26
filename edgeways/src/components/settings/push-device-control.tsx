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

function formatAgo(ms: number | null): string {
  if (ms == null) return "never delivered";
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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
  const [origin, setOrigin] = useState("");
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
      } catch (e) {
        setProbeNote(`Could not sync to server: ${String(e)}`);
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
      setOrigin(window.location.origin);
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
      toast.success(`Push registered (${deviceLabel()})`);
    } catch (e) {
      const msg = String(e);
      setProbeNote(msg);
      toast.error("Could not enable push", { description: msg });
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
      toast.success("Push disabled on this device");
    } catch (e) {
      toast.error("Could not disable push", { description: String(e) });
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
        toast.success(`Test push sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`, {
          description: names || undefined,
        });
      } else if (res.sent > 0) {
        toast.warning(`Sent to ${res.sent}, ${res.pruned + res.failed} failed`, {
          description: (res.failures ?? [])
            .map((f) => `${f.label ?? "Device"}: ${f.reason}`)
            .join("; "),
        });
      } else if (res.pruned + res.failed > 0) {
        toast.error("Test push failed on every device", {
          description:
            (res.failures ?? []).map((f) => `${f.label ?? "Device"}: ${f.reason}`).join("; ") ||
            "Subscriptions may have expired - use Re-register below.",
        });
      } else {
        toast.info("No devices on the server yet", {
          description: "Tap Register for background push on this phone first.",
        });
      }
    } catch (e) {
      toast.error("Test push failed", { description: String(e) });
    }
    });
  }

  if (secure == null || supported == null) return null;

  const deviceList =
    devices.length > 0 ? (
      <ul className="flex flex-col gap-1 border-t pt-2">
        {devices.map((d) => (
          <li
            key={d.id}
            className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
          >
            <span className="font-medium text-foreground">{d.label ?? "Device"}</span>
            <span>last ok {formatAgo(d.lastOkAt)}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs text-muted-foreground border-t pt-2">No devices on the server yet.</p>
    );

  if (!secure) {
    return (
      <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
        <p className="text-sm font-medium">Push needs a secure origin</p>
        <p className="text-xs text-muted-foreground">
          This tab is on <span className="font-medium text-foreground">{origin || "http"}</span>.
          Organic alerts can still appear while the app is open, but background push cannot
          register. Open{" "}
          <span className="font-medium text-foreground">
            https://sams-mac-studio.tail975520.ts.net
          </span>{" "}
          in Chrome with Tailscale on, use that Home Screen shortcut, then register push there.
        </p>
        {deviceList}
        <Link
          href="/help?guide=mobile"
          className="self-start text-xs text-primary-text underline-offset-2 hover:underline"
        >
          Mobile &amp; push guide
        </Link>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
        <p className="text-xs text-muted-foreground">
          This browser has no PushManager on{" "}
          <span className="font-medium text-foreground">{origin}</span>. Use Chrome, not an
          in-app WebView.
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
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Background push</p>
          <p className="text-xs text-muted-foreground">
            Separate from organic alerts while the app is open. Register on each device once;
            Send test push fans out to every device on the list (from Mac or phone).
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground break-all">{origin}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permission: {permission}
            {" · "}
            Local sub: {localSub ? "yes" : "no"}
            {" · "}
            On server: {onServer ? "yes" : "no"}
          </p>
        </div>
        <Switch
          checked={registered}
          disabled={busy}
          aria-label="Enable background push on this device"
          onCheckedChange={(v) => void (v ? registerPush(false) : unsubscribe())}
        />
      </div>

      {desynced ? (
        <p className="text-xs text-warning">
          This browser has a local push subscription that is not on the server (common after a
          prune or failed save). Tap Re-register below.
        </p>
      ) : null}

      {probeNote ? <p className="text-xs text-destructive break-words">{probeNote}</p> : null}

      {deviceList}

      {phoneMissing && !registered ? (
        <p className="text-xs text-muted-foreground">
          Server only has a desktop browser. Open this Settings screen on the phone (check the
          origin line is https://…ts.net) and register push there.{" "}
          <Link
            href="/help?guide=mobile"
            className="text-primary-text underline-offset-2 hover:underline"
          >
            Setup guide
          </Link>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!registered ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void registerPush(desynced)}
          >
            {desynced ? "Re-register this device" : "Register for background push"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void registerPush(true)}
          >
            Re-register
          </Button>
        )}
        {devices.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void sendTest()}
          >
            Send test push
          </Button>
        ) : null}
      </div>
    </div>
  );
}
