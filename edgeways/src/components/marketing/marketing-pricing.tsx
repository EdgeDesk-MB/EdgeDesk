"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  annualLabel,
  monthlyLabel,
  comparisonRows,
  planCheckoutHref,
  PUBLIC_PLANS,
  TRIAL_DAYS,
  trialOfferSummary,
  yearlyBillingSummary,
  yearlyDealCue,
  yearlyDealLabel,
  type BillingInterval,
  type PublicPlan,
} from "@/lib/billing/public-offer";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import {
  PricingCta,
  useMarketingPricingAction,
} from "@/components/marketing/pricing-cta";
import { SETTINGS_SUBSCRIPTION_HREF } from "@/lib/billing/subscription-view";
import { cn } from "@/lib/utils";

function CellMark({
  on,
  planId,
}: {
  on: boolean;
  planId: PublicPlan["id"];
}) {
  return (
    <span className="inline-flex justify-center">
      {on ? (
        <Check
          className={cn(
            "size-6",
            planId === "free" && "text-white",
            planId === "core" && "text-[var(--marketing-brand)]",
            planId === "edge" && "text-edge"
          )}
          strokeWidth={2}
          aria-label="Included"
        />
      ) : (
        <X
          className="size-6 text-white/45"
          strokeWidth={2}
          aria-label="Not included"
        />
      )}
    </span>
  );
}

function IntervalOption({
  value,
  label,
  interval,
  onChange,
}: {
  value: BillingInterval;
  label: string;
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
}) {
  const active = interval === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={
        value === "year" ? `${label}, ${yearlyDealLabel()}` : label
      }
      tabIndex={active ? 0 : -1}
      data-interval={value}
      onClick={() => onChange(value)}
      onKeyDown={(event) => {
        if (
          event.key !== "ArrowRight" &&
          event.key !== "ArrowLeft" &&
          event.key !== "ArrowUp" &&
          event.key !== "ArrowDown"
        ) {
          return;
        }
        event.preventDefault();
        const next = value === "month" ? "year" : "month";
        onChange(next);
        const root = event.currentTarget.parentElement;
        requestAnimationFrame(() => {
          root
            ?.querySelector<HTMLButtonElement>(`[data-interval="${next}"]`)
            ?.focus();
        });
      }}
      className="marketing-interval-option"
    >
      {label}
    </button>
  );
}

function YearlyDealArrow() {
  return (
    <img
      src="/brand/arrow.svg"
      alt=""
      width={23}
      height={30}
      aria-hidden
      className="marketing-interval-arrow"
    />
  );
}

function IntervalToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
}) {
  return (
    <div className="marketing-interval-cluster">
      <button
        type="button"
        className="marketing-interval-deal"
        onClick={() => onChange("year")}
      >
        {yearlyDealCue()}
      </button>
      <YearlyDealArrow />
      <div
        role="radiogroup"
        aria-label="Pay monthly or yearly"
        data-interval={interval}
        className="marketing-interval"
      >
        <IntervalOption
          value="month"
          label="Bill monthly"
          interval={interval}
          onChange={onChange}
        />
        <span
          role="presentation"
          className="marketing-interval-track"
          onClick={() => onChange(interval === "month" ? "year" : "month")}
        >
          <span className="marketing-interval-well">
            <span className="marketing-interval-thumb" />
          </span>
        </span>
        <IntervalOption
          value="year"
          label="Bill yearly"
          interval={interval}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  featured,
  interval,
  showCheckout,
}: {
  plan: PublicPlan;
  featured?: boolean;
  interval: BillingInterval;
  showCheckout: boolean;
}) {
  const paid = plan.monthlyPence > 0;
  const yearly = interval === "year" && paid;
  const price = yearly ? annualLabel(plan) : monthlyLabel(plan);
  const sub = !paid
    ? "Always free"
    : yearly
      ? "Billed yearly"
      : "Billed monthly";

  return (
    <article
      className={cn(
        "marketing-panel flex flex-col rounded-[var(--radius-button)] p-5 text-left",
        featured && "marketing-panel-plan"
      )}
    >
      {featured ? <span className="marketing-panel-shine" aria-hidden /> : null}
      <div className="flex h-7 items-center justify-between gap-2">
        <h3 className="text-lg font-semibold leading-none text-white">
          {plan.name}
        </h3>
        {plan.id === "edge" ? (
          <p className="shrink-0 text-xs font-medium text-edge">
            Recommended
          </p>
        ) : plan.id === "core" ? (
          <p className="shrink-0 text-xs font-medium text-white/55">
            Popular
          </p>
        ) : null}
      </div>
      <div aria-live={paid ? "polite" : undefined}>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
          {price}
        </p>
        <p className="mt-1 text-sm text-white/55">{sub}</p>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-white/60">
        {plan.blurb}
      </p>
      <div className="mt-5 min-h-10">
        {showCheckout ? (
          <PricingCta
            href={planCheckoutHref(plan, interval)}
            className={cn(
              "inline-flex w-full justify-center rounded-[var(--radius-button)] px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              plan.id === "edge" &&
                "bg-edge text-edge-foreground focus-visible:outline-[var(--edge)]",
              plan.id === "core" &&
                "bg-[var(--marketing-brand)] text-[var(--marketing-ink)] focus-visible:outline-[var(--marketing-brand)]",
              plan.id === "free" &&
                "border border-white/20 text-white transition-colors hover:bg-white/5 hover:opacity-100 focus-visible:outline-[var(--marketing-brand)]"
            )}
          >
            {plan.cta}
          </PricingCta>
        ) : null}
      </div>
    </article>
  );
}

/** Public offer only. Founding stays off these cards. */
export function MarketingPricing() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const pricingAction = useMarketingPricingAction();
  const showCheckout = pricingAction === "checkout";
  const rows = comparisonRows();
  const plans = PUBLIC_PLANS;

  return (
    <section
      id="pricing"
      className="border-t border-white/10 px-5 py-16 sm:px-8 sm:py-20"
    >
      <div className="mx-auto max-w-5xl">
        <div className="text-center" data-reveal="">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Choose a plan
          </h2>
          <p className="mx-auto mt-3 text-base text-white/55">
            The Edge plan starts with a {TRIAL_DAYS}-day trial. Cancel during
            the trial and you are not charged.
          </p>
          <IntervalToggle interval={interval} onChange={setInterval} />
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3" data-reveal-stagger="">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              featured={plan.id === "edge"}
              interval={interval}
              showCheckout={showCheckout}
            />
          ))}
        </div>
        {pricingAction !== "checkout" ? (
          <div className="mt-6 flex min-h-10 justify-center">
            {pricingAction === "manage" ? (
              <PricingCta
                href={SETTINGS_SUBSCRIPTION_HREF}
                className="inline-flex justify-center rounded-[var(--radius-button)] bg-[var(--marketing-brand)] px-4 py-2.5 text-sm font-semibold text-[var(--marketing-ink)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
              >
                Manage subscription
              </PricingCta>
            ) : null}
          </div>
        ) : null}

        <div data-reveal="">
          <ScrollFadeEdges
            orientation="horizontal"
            fadeClassName="from-[var(--marketing-canvas)]"
            fadeSize={40}
            className="mt-12"
            scrollClassName="overflow-x-auto"
          >
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Feature comparison for Free, Core, and Edge
            </caption>
            <thead>
              <tr className="border-b border-white/15">
                <th className="py-3 pr-4 font-medium text-white/55">
                  Included
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.id}
                    className={cn(
                      "px-3 py-3 text-center font-semibold",
                      plan.id === "core" && "text-[var(--marketing-brand)]",
                      plan.id === "edge" && "text-edge",
                      plan.id === "free" && "text-white"
                    )}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.flag} className="border-b border-white/10">
                  <th className="w-[min(28rem,58%)] py-4 pr-6 text-left font-normal align-top">
                    <span className="block text-base font-semibold text-white">
                      {row.title}
                    </span>
                    <span className="mt-1 block text-sm font-normal leading-relaxed text-white/55">
                      {row.description}
                    </span>
                  </th>
                  {plans.map((plan) => (
                    <td
                      key={plan.id}
                      className="px-3 py-4 text-center align-top"
                    >
                      <CellMark on={row.included[plan.id]} planId={plan.id} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollFadeEdges>
          <p className="mt-6 text-sm text-white/55">
            {yearlyBillingSummary()} {trialOfferSummary()}
          </p>
        </div>
      </div>
    </section>
  );
}
