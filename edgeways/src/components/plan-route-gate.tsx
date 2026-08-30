"use client";

import { usePathname } from "next/navigation";
import { PlanLockEmpty } from "@/components/plan-lock-empty";
import { PageLoading } from "@/components/page-loading";
import { useAppState } from "@/hooks/use-app-state";
import { featureForDeskPath } from "@/lib/entitlements/nav";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { requiredPlan } from "@/lib/entitlements/plans";
import { PageShell } from "@/components/page-shell";

/**
 * Locks gated surfaces by the signed-in user's real plan (EDGE-22). The
 * Settings viewing bar may only step down from the paid plan. Public demo /
 * signed-out sessions keep the legacy preview behaviour.
 *
 * Nav lets the user open the page. This plate is the lock, not a toast.
 */
export function PlanRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useAppState();
  const feature = featureForDeskPath(pathname);
  if (!feature || requiredPlan(feature) === "free") return children;
  if (state == null) {
    return <PageLoading label="Loading …" description="Checking your plan." />;
  }
  if (canDesk(state.settings, feature)) return children;
  return (
    <PageShell>
      <PlanLockEmpty feature={feature} className="flex-1" />
    </PageShell>
  );
}
