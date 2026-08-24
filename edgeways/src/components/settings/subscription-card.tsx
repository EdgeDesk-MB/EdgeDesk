"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { requestBillingPortal } from "@/lib/billing/open-portal";
import { planCheckoutHref, PUBLIC_PLANS } from "@/lib/billing/public-offer";
import {
  billingStatusBadgeVariant,
  billingStatusLabel,
  planDisplayName,
  showSubscribeActions,
  type SubscriptionAccount,
  subscriptionDateLabel,
} from "@/lib/billing/subscription-view";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import type { PlanPreview } from "@/lib/entitlements/plans";
import type { AppSettings } from "@/lib/services/settings-shared";
import { edgePanel, quietPanel, sectionDescription } from "@/lib/ui/surface-styles";

const TILE_VALUE = "h-8 min-w-0 gap-2 text-lg";

const PUBLIC_DEMO_ACCOUNT: SubscriptionAccount = {
  plan: "free",
  billingStatus: "none",
  trialEndsAt: null,
  founding: false,
  canManage: false,
};

export function SubscriptionCard({
  planPreview = "unlocked",
  onPatch,
}: {
  planPreview?: PlanPreview;
  onPatch?: (patch: Partial<Pick<AppSettings, "planPreview">>) => void;
}) {
  const { active: publicDemo } = usePublicDemo();
  const [account, setAccount] = useState<SubscriptionAccount | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function load() {
    setFailed(false);
    try {
      const response = await fetch("/api/billing/account");
      if (!response.ok) throw new Error("Could not load the plan.");
      const data = (await response.json()) as SubscriptionAccount;
      setAccount(data);
    } catch {
      setFailed(true);
      setAccount(null);
    }
  }

  useEffect(() => {
    if (publicDemo) {
      setFailed(false);
      setAccount(PUBLIC_DEMO_ACCOUNT);
      return;
    }
    void load();
  }, [publicDemo]);

  async function openPortal() {
    setPending(true);
    try {
      const url = await requestBillingPortal();
      window.location.assign(url);
    } catch {
      setPending(false);
      toast.error("Could not open billing", {
        description: "Try again in a moment.",
      });
    }
  }

  const core = PUBLIC_PLANS.find((plan) => plan.id === "core");
  const edge = PUBLIC_PLANS.find((plan) => plan.id === "edge");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" aria-hidden />
          <Label className="text-sm font-semibold">Subscription</Label>
        </div>
        <p className={sectionDescription}>
          Plan, trial and billing. Card, invoices and cancel live with Stripe.
        </p>
      </div>

      {failed ? (
        <EmptyState
          compact
          icon={CreditCard}
          title="Could not load the plan"
          description="Try again in a moment."
          action={{ label: "Try again", onClick: () => void load() }}
        />
      ) : !account ? (
        <EmptyState
          compact
          busy
          icon={CreditCard}
          title="Loading your plan"
          description="Plan and trial status will appear here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <StatStrip columns={2}>
            <StatTile
              label="Plan"
              valueClassName={TILE_VALUE}
              value={
                <>
                  {planDisplayName(account.plan)}
                  <Badge
                    variant={billingStatusBadgeVariant(account.billingStatus)}
                    className="h-5 px-1.5"
                  >
                    {billingStatusLabel(account.billingStatus)}
                  </Badge>
                </>
              }
              sub={planTileSub(account, publicDemo)}
            />
            <StatTile
              label="Billing"
              valueClassName={TILE_VALUE}
              value={billingTileValue(account)}
              sub={billingTileSub(account)}
            />
          </StatStrip>

          {publicDemo ? (
            <p className={sectionDescription}>
              Subscribe from a real account to manage billing.
            </p>
          ) : null}

          <PlanPreviewInvite
            planPreview={planPreview}
            billedPlan={account.plan}
            publicDemo={publicDemo}
            onPatch={onPatch}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {account.canManage ? (
              <Button
                size="sm"
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={() => void openPortal()}
              >
                Manage billing
              </Button>
            ) : null}
            {showSubscribeActions(account) && edge ? (
              <Button
                size="sm"
                variant="edge"
                onClick={() => window.location.assign(planCheckoutHref(edge, "month"))}
              >
                {edge.cta}
              </Button>
            ) : null}
            {showSubscribeActions(account) && core ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.assign(planCheckoutHref(core, "month"))}
              >
                {core.cta}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanPreviewInvite({
  planPreview,
  billedPlan,
  publicDemo,
  onPatch,
}: {
  planPreview: PlanPreview;
  billedPlan: SubscriptionAccount["plan"];
  publicDemo: boolean;
  onPatch?: (patch: Partial<Pick<AppSettings, "planPreview">>) => void;
}) {
  if (publicDemo || billedPlan === "edge" || onPatch == null) return null;

  const patch = onPatch;
  const previewing = planPreview === "edge" || planPreview === "unlocked";
  const billedName = planDisplayName(billedPlan);

  function startPreview() {
    patch({ planPreview: "edge" });
  }

  function stopPreview() {
    patch({ planPreview: billedPlan === "core" ? "core" : "free" });
  }

  if (previewing) {
    return (
      <div className={`${edgePanel} flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="min-w-0">
          <p className="text-sm font-medium">Previewing Edge</p>
          <p className={sectionDescription}>
            Live racing and Offer Edge picks are on. Start a trial to keep them.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={stopPreview}>
          Back to {billedName}
        </Button>
      </div>
    );
  }

  return (
    <div className={`${quietPanel} flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="min-w-0">
        <p className="text-sm font-medium">Try Edge</p>
        <p className={sectionDescription}>
          Walk the full desk for a look. Your billed plan does not change.
        </p>
      </div>
      <Button size="sm" variant="edge" onClick={startPreview}>
        Try Edge
      </Button>
    </div>
  );
}

function planTileSub(
  account: SubscriptionAccount,
  publicDemo: boolean
): string | undefined {
  if (publicDemo) return "Public demo";
  if (account.billingStatus === "past_due") return "Update the card";
  if (account.founding) return "Founding rate";
  if (account.billingStatus === "canceled") return "Until period ends";
  if (account.plan === "free") return "Manual bet log";
  return undefined;
}

function billingTileValue(account: SubscriptionAccount): string {
  if (account.billingStatus === "trialing" && account.trialEndsAt) {
    return subscriptionDateLabel(account.trialEndsAt);
  }
  return account.canManage ? "Stripe" : "None";
}

function billingTileSub(account: SubscriptionAccount): string {
  if (account.billingStatus === "trialing" && account.trialEndsAt) {
    return "Trial ends";
  }
  if (account.billingStatus === "trialing") return "Trial is live";
  if (account.canManage) return "Card and invoices";
  return "No billing yet";
}
