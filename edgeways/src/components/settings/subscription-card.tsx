"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { ReferralSharePanel } from "@/components/referrals/referral-share-panel";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { requestBillingPortal } from "@/lib/billing/open-portal";
import {
  monthlyLabel,
  planCheckoutHref,
  PUBLIC_PLANS,
  SETTINGS_PLAN_HIGHLIGHTS,
  TRIAL_DAYS,
} from "@/lib/billing/public-offer";
import {
  billingStatusBadgeVariant,
  billingStatusLabel,
  isCancelling,
  isComplimentaryAccount,
  planDisplayName,
  showSubscribeActions,
  type SubscriptionAccount,
  subscriptionDateLabel,
} from "@/lib/billing/subscription-view";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { availableOnSubscriptionTitle } from "@/lib/entitlements/nav";
import type { PlanPreview } from "@/lib/entitlements/plans";
import type { AppSettings } from "@/lib/services/settings-shared";
import { cn } from "@/lib/utils";
import { quietPanel, edgePanel, sectionDescription } from "@/lib/ui/surface-styles";

const TILE_VALUE = "h-8 min-w-0 gap-2 text-lg";

const PUBLIC_DEMO_ACCOUNT: SubscriptionAccount = {
  plan: "free",
  billingStatus: "none",
  trialEndsAt: null,
  cancelAt: null,
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
  const [account, setAccount] = useState<SubscriptionAccount | null>(
    publicDemo ? PUBLIC_DEMO_ACCOUNT : null
  );
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  const [prevPublicDemo, setPrevPublicDemo] = useState(publicDemo);
  if (prevPublicDemo !== publicDemo) {
    setPrevPublicDemo(publicDemo);
    if (publicDemo) {
      setFailed(false);
      setAccount(PUBLIC_DEMO_ACCOUNT);
    }
  }

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
    if (publicDemo) return;
    queueMicrotask(() => void load());
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" aria-hidden />
          <Label className="text-sm font-semibold">Subscription</Label>
        </div>
        <p className={sectionDescription}>
          Plan, trial and billing.
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
                    variant={
                      isCancelling(account)
                        ? "outline"
                        : billingStatusBadgeVariant(account.billingStatus)
                    }
                    className="h-5 px-1.5"
                  >
                    {isCancelling(account)
                      ? "Cancelling"
                      : billingStatusLabel(account.billingStatus)}
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

          {account.canManage ? (
            <div>
              <Button
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={() => void openPortal()}
                {...pagePrimaryButtonProps}
              >
                Manage subscription
              </Button>
            </div>
          ) : isComplimentaryAccount(account) ? (
            <p className={sectionDescription}>No Stripe portal.</p>
          ) : null}

          {showSubscribeActions(account) ? (
            <PlanChoiceGrid publicDemo={publicDemo} />
          ) : null}
          <PlanPreviewStatus
            planPreview={planPreview}
            billedPlan={account.plan}
            publicDemo={publicDemo}
            onPatch={onPatch}
          />
        </div>
      )}

      {!publicDemo ? <ReferralSharePanel /> : null}
    </div>
  );
}

function PlanChoiceGrid({ publicDemo }: { publicDemo: boolean }) {
  const core = PUBLIC_PLANS.find((plan) => plan.id === "core");
  const edge = PUBLIC_PLANS.find((plan) => plan.id === "edge");
  if (!core || !edge) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
        <article className={cn(quietPanel, "flex flex-col gap-3 p-4")}>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold">{availableOnSubscriptionTitle("core")}</p>
            <p className="text-lg font-semibold tabular-nums">{monthlyLabel(core)}</p>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {SETTINGS_PLAN_HIGHLIGHTS.core.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary-text" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {publicDemo ? null : (
            <Button
              className="mt-auto w-full"
              {...pagePrimaryButtonProps}
              onClick={() => window.location.assign(planCheckoutHref(core, "month"))}
            >
              {core.cta}
            </Button>
          )}
        </article>
        <article className={cn(edgePanel, "flex flex-col gap-3 p-4")}>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold">{availableOnSubscriptionTitle("edge")}</p>
            <p className="text-lg font-semibold tabular-nums">
              {monthlyLabel(edge)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                after {TRIAL_DAYS} days free
              </span>
            </p>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {SETTINGS_PLAN_HIGHLIGHTS.edge.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-edge" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {publicDemo ? null : (
            <Button
              className="mt-auto w-full"
              variant="edge"
              onClick={() => window.location.assign(planCheckoutHref(edge, "month"))}
            >
              {edge.cta}
            </Button>
          )}
        </article>
      </div>
  );
}

function PlanPreviewStatus({
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
  if (planPreview !== "edge") return null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className={sectionDescription}>
        Previewing Edge. Live racing and Offer Edge picks are on.
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onPatch({ planPreview: billedPlan === "core" ? "core" : "free" })
        }
      >
        Back to {planDisplayName(billedPlan)}
      </Button>
    </div>
  );
}

function planTileSub(
  account: SubscriptionAccount,
  publicDemo: boolean
): string | undefined {
  if (publicDemo) return "Public demo";
  if (isComplimentaryAccount(account)) return "Complimentary grant";
  if (account.billingStatus === "past_due") return "Update the card";
  if (account.founding) return "Founding rate";
  if (account.billingStatus === "canceled") return "Until period ends";
  if (account.plan === "free") return "Bet log and wallets";
  return undefined;
}

function billingTileValue(account: SubscriptionAccount): string {
  if (isCancelling(account) && account.cancelAt) {
    return subscriptionDateLabel(account.cancelAt);
  }
  if (account.billingStatus === "trialing" && account.trialEndsAt) {
    return subscriptionDateLabel(account.trialEndsAt);
  }
  if (isComplimentaryAccount(account)) return "Complimentary";
  return account.canManage ? "Stripe" : "None";
}

function billingTileSub(account: SubscriptionAccount): string {
  if (isCancelling(account)) return "Access ends";
  if (account.billingStatus === "trialing" && account.trialEndsAt) {
    return "Trial ends";
  }
  if (account.billingStatus === "trialing") return "Trial is live";
  if (isComplimentaryAccount(account)) return "No card required";
  if (account.canManage) return "Card and invoices";
  return "No billing yet";
}
