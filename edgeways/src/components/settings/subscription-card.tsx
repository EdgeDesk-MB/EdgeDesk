"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/help/empty-state";
import { requestBillingPortal } from "@/lib/billing/open-portal";
import { planCheckoutHref, PUBLIC_PLANS } from "@/lib/billing/public-offer";
import {
  billingStatusBadgeVariant,
  billingStatusLabel,
  planDisplayName,
  showSubscribeActions,
  type SubscriptionAccount,
  subscriptionDetail,
} from "@/lib/billing/subscription-view";
import { sectionDescription } from "@/lib/ui/surface-styles";

export function SubscriptionCard() {
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
    void load();
  }, []);

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
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight">
              {planDisplayName(account.plan)}
            </h3>
            <Badge variant={billingStatusBadgeVariant(account.billingStatus)}>
              {billingStatusLabel(account.billingStatus)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{subscriptionDetail(account)}</p>

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
