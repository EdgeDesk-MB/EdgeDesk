"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { EmptyState } from "@/components/help/empty-state";
import { PlanLockEmpty } from "@/components/plan-lock-empty";
import { PageLoading } from "@/components/page-loading";
import { useAppState } from "@/hooks/use-app-state";
import { featureForDeskPath } from "@/lib/entitlements/nav";
import { planGatePhase } from "@/lib/entitlements/plan-route-gate";
import {
  readChromeSnapshot,
  type ChromeSnapshot,
} from "@/lib/chrome-snapshot";
import { PageShell } from "@/components/page-shell";

/**
 * Locks gated surfaces by the signed-in user's real plan (EDGE-22). The
 * Settings viewing bar may only step down from the paid plan. Public demo /
 * signed-out sessions keep the legacy preview behaviour.
 *
 * Nav lets the user open the page. This plate is the lock, not a toast.
 * Chrome settings unlock the first paint so Offers is not stuck on
 * "Checking your plan" while /api/state is still in flight.
 */
export function PlanRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, error, refresh } = useAppState();
  const [cachedChrome, setCachedChrome] = useState<ChromeSnapshot | null>(null);
  useLayoutEffect(() => {
    setCachedChrome(readChromeSnapshot());
  }, []);
  const feature = featureForDeskPath(pathname);
  const settings = state?.settings ?? cachedChrome?.settings;
  const phase = planGatePhase({
    pathname,
    settings,
    hasState: state != null,
    error,
  });
  if (phase === "pass") return children;
  if (phase === "lock" && feature) {
    return (
      <PageShell>
        <PlanLockEmpty feature={feature} className="flex-1" />
      </PageShell>
    );
  }
  if (phase === "error") {
    return (
      <PageShell>
        <EmptyState
          title="Could not load this page"
          description="Check the connection, then try again."
          action={{ label: "Try again", onClick: () => void refresh() }}
        />
      </PageShell>
    );
  }
  return <PageLoading label="Loading …" description="Checking your plan." />;
}
