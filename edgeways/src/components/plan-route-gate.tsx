"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { useAppState } from "@/hooks/use-app-state";
import { featureForDeskPath, planLockCopy } from "@/lib/entitlements/nav";
import { canWithPreview } from "@/lib/entitlements/plans";
import { PageShell } from "@/components/page-shell";

/**
 * Locks specified N0 surfaces when Settings / demo planPreview is Free or Core.
 * Unlocked (Sam's daily default) is a no-op.
 */
export function PlanRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useAppState();
  const feature = featureForDeskPath(pathname);
  if (!feature || canWithPreview(state?.settings, feature)) {
    return children;
  }
  const copy = planLockCopy(feature);
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
