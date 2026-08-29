"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EPHEMERAL_ALERT_TOAST_MS } from "@/lib/alerts/local-channel";
import {
  bundleNewEvents,
  emptyLiveBundleMemory,
  reconcileLiveCritical,
  type LiveBundle,
  type LiveEvent,
} from "@/lib/admin/live-bundle";
import {
  DEFAULT_ADMIN_LIVE_SETTINGS,
  liveBundleConfigFromSettings,
  type AdminLiveSettings,
} from "@/lib/admin/live-settings-shared";

type LivePollResponse = {
  fingerprint: string;
  now: number;
  events: LiveEvent[];
  activeCriticalKeys: string[];
  settings: AdminLiveSettings;
};

function liveToastAction(
  href: string,
  navigate: (href: string) => void
): { label: string; onClick: () => void } {
  const label =
    href === "/admin/feeds"
      ? "Open feeds"
      : href === "/admin/health"
        ? "Open health"
        : href === "/admin/users"
          ? "Open users"
          : "Open activity";
  return { label, onClick: () => navigate(href) };
}

function showLiveBundles(
  bundles: LiveBundle[],
  navigate: (href: string) => void
): void {
  for (const bundle of bundles) {
    const options = {
      id: bundle.id,
      description: bundle.body,
      duration:
        bundle.tone === "success" ? EPHEMERAL_ALERT_TOAST_MS : Number.POSITIVE_INFINITY,
      closeButton: bundle.tone !== "success",
      action: liveToastAction(bundle.href, navigate),
    };
    if (bundle.tone === "success") toast.success(bundle.title, options);
    else if (bundle.tone === "warning") toast.warning(bundle.title, options);
    else toast.error(bundle.title, options);
  }
}

export function AdminLiveProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sinceRef = useRef(Date.now());
  const fingerprintRef = useRef<string | null>(null);
  const memoryRef = useRef(emptyLiveBundleMemory());
  const settingsRef = useRef(DEFAULT_ADMIN_LIVE_SETTINGS);
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick(forceHiddenDigest: boolean) {
      if (cancelled || inFlightRef.current) return;
      const hidden = typeof document !== "undefined" && document.hidden;
      if (hidden && !forceHiddenDigest) return;

      inFlightRef.current = true;
      try {
        const res = await fetch(`/api/admin/live?since=${sinceRef.current}`, {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const body = (await res.json()) as LivePollResponse;
        if (cancelled) return;

        settingsRef.current = body.settings ?? settingsRef.current;
        const config = liveBundleConfigFromSettings(settingsRef.current);
        const { bundles, memory } = bundleNewEvents({
          events: body.events ?? [],
          now: body.now,
          memory: memoryRef.current,
          config,
        });
        memoryRef.current = reconcileLiveCritical(
          memory,
          body.activeCriticalKeys ?? []
        );
        sinceRef.current = body.now;

        const visible = !document.hidden;
        if (visible && settingsRef.current.toastsEnabled) {
          showLiveBundles(bundles, (href) => router.push(href));
        }

        if (fingerprintRef.current == null) {
          fingerprintRef.current = body.fingerprint;
        } else if (body.fingerprint !== fingerprintRef.current) {
          fingerprintRef.current = body.fingerprint;
          if (visible) router.refresh();
        }
      } catch {
        // Poll is best-effort. The next tick retries.
      } finally {
        inFlightRef.current = false;
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void tick(false).then(schedule);
      }, settingsRef.current.pollMs);
    }

    function onVisibility() {
      if (!document.hidden) void tick(true);
    }

    void tick(false).then(schedule);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return children;
}
