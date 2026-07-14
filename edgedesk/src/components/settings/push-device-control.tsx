"use client";

/**
 * F3 - per-device web-push opt-in. Subscribing registers this browser with
 * the local server's VAPID keys; sentinel alerts then arrive with every
 * EdgeDesk tab closed. Requires the server to be running to send.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/hooks/use-app-state";

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

export function PushDeviceControl() {
  // null = still probing; false = unsupported or not subscribed
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    queueMicrotask(() => setSupported(ok));
    if (!ok) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(sub != null))
      .catch(() => setSubscribed(false));
    void api<{ devices: unknown[] }>("/api/push")
      .then((r) => setDeviceCount(r.devices.length))
      .catch(() => {});
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications blocked", {
          description: "Allow notifications for this site to enable push.",
        });
        return;
      }
      const { publicKey } = await api<{ publicKey: string }>("/api/push");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await api("/api/push", {
        method: "POST",
        json: { subscription: sub.toJSON(), label: deviceLabel() },
      });
      setSubscribed(true);
      setDeviceCount((n) => n + 1);
      toast.success("Push enabled on this device");
    } catch (e) {
      toast.error("Could not enable push", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/api/push", { method: "DELETE", json: { endpoint: sub.endpoint } }).catch(
          () => {}
        );
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setDeviceCount((n) => Math.max(0, n - 1));
      toast.success("Push disabled on this device");
    } catch (e) {
      toast.error("Could not disable push", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const res = await api<{ sent: number; pruned: number }>("/api/push", {
        method: "POST",
        json: { test: true },
      });
      if (res.sent > 0) {
        toast.success(`Test push sent to ${res.sent} device${res.sent === 1 ? "" : "s"}`);
      } else {
        toast.info("No devices subscribed yet");
      }
    } catch (e) {
      toast.error("Test push failed", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  if (supported == null) return null;
  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Background push needs a browser with service worker support.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Push to this device</p>
          <p className="text-xs text-muted-foreground">
            Alerts arrive with the app closed, via the browser&apos;s push relay.
            {deviceCount > 0
              ? ` ${deviceCount} device${deviceCount === 1 ? "" : "s"} subscribed.`
              : ""}
          </p>
        </div>
        <Switch
          checked={subscribed}
          disabled={busy}
          aria-label="Enable push notifications on this device"
          onCheckedChange={(v) => void (v ? subscribe() : unsubscribe())}
        />
      </div>
      {deviceCount > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={() => void sendTest()}
        >
          Send test push
        </Button>
      ) : null}
    </div>
  );
}
