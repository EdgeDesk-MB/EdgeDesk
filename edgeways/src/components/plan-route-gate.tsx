"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import { featureForDeskPath, planLockCopy } from "@/lib/entitlements/nav";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { PageShell } from "@/components/page-shell";

/**
 * Locks gated surfaces by the signed-in user's real plan (EDGE-22). The
 * Settings viewing bar may only step down from the paid plan. Public demo /
 * signed-out sessions keep the legacy preview behaviour.
 */
export function PlanRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useAppState();
  const feature = featureForDeskPath(pathname);
  if (!feature || canDesk(state?.settings, feature)) {
    return children;
  }
  const copy = planLockCopy(feature, { real: state?.settings?.billing != null });
  return (
    <PageShell>
      <EmptyState
        icon={Lock}
        title={copy.title}
        description={copy.description}
        className="mx-auto w-full max-w-lg flex-1"
      />
    </PageShell>
  );
}
