"use client";

import Link from "next/link";
import { Lock, Zap } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { Button } from "@/components/ui/button";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { useAppState } from "@/hooks/use-app-state";
import {
  EDGE_DESK_PROMOS,
  planLockEmptyCopy,
} from "@/lib/entitlements/nav";
import { requiredPlan } from "@/lib/entitlements/plans";
import type { FeatureFlag } from "@/lib/entitlements/features";
import { edgeLockBanner } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * In-page plan lock. Core pages use the plated empty. Edge desks that
 * still work use a full-width purple banner.
 */
type PlanLockEmptyProps = {
  compact?: boolean;
  className?: string;
} & (
  | { feature: FeatureFlag; promo?: never }
  | { promo: keyof typeof EDGE_DESK_PROMOS; feature?: never }
);

export function PlanLockEmpty({
  feature,
  promo,
  compact,
  className,
}: PlanLockEmptyProps) {
  const deskPromo = promo ? EDGE_DESK_PROMOS[promo] : null;
  const flag: FeatureFlag = deskPromo?.feature ?? feature!;
  const { state } = useAppState();
  const { active: publicDemo } = usePublicDemo();
  const copy = planLockEmptyCopy(flag, {
    real: state?.settings?.billing != null,
    publicDemo,
  });
  const plan = requiredPlan(flag);
  const title = deskPromo?.title ?? copy.title;
  const description = deskPromo?.description ?? copy.description;
  const showSecondary = promo !== "twoUp";

  if (deskPromo) {
    return (
      <div
        data-edge-lock-banner=""
        className={cn(edgeLockBanner, className)}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-edge text-edge-foreground"
              aria-hidden
            >
              <Zap className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-pretty break-words text-base font-semibold text-edge">
                {title}
              </p>
              <p className="text-pretty break-words text-sm leading-snug text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Button asChild variant="edge" size="lg">
              <Link href={copy.action.href}>{copy.action.label}</Link>
            </Button>
            {showSecondary ? (
              <Button variant="outline" size="lg" asChild>
                <Link href={copy.secondaryAction.href}>
                  {copy.secondaryAction.label}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <EmptyState
      icon={plan === "edge" ? Zap : Lock}
      title={title}
      description={description}
      action={copy.action}
      secondaryAction={copy.secondaryAction}
      compact={compact}
      className={cn(
        compact ? "mx-auto w-full max-w-lg" : "w-full min-w-0 flex-1",
        className
      )}
    />
  );
}
