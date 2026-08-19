import { BOLT_PATH } from "@/lib/brand/bolt-mark";
import type { SubscribeReceiptView } from "@/lib/billing/receipt-view";
import { ManageBillingButton } from "@/components/marketing/manage-billing-button";

function Row({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-6">
      <dt className="shrink-0 text-[var(--marketing-ink)]/70">{label}</dt>
      <dd
        className={
          mono
            ? "min-w-0 text-pretty break-words text-right font-mono tabular-nums"
            : "min-w-0 text-pretty break-words text-right"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function SubscribeReceipt({ receipt }: { receipt: SubscribeReceiptView }) {
  return (
    <article
      aria-label="Subscription receipt"
      className="marketing-receipt w-full text-sm text-[var(--marketing-ink)]"
    >
      <div className="marketing-receipt-tooth marketing-receipt-tooth-top" />
      <header className="flex flex-col items-center px-7 pt-8 text-center">
        <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
          <path d={BOLT_PATH} fill="var(--marketing-ink)" />
        </svg>
        <p className="mt-3 text-sm font-semibold tracking-[0.18em]">EDGEWAYS</p>
        <p className="mt-2 text-xs text-[var(--marketing-ink)]/70">
          edgeways.app
        </p>
      </header>

      <dl className="mt-8 space-y-3 px-7">
        <Row
          label="Item"
          value={`${receipt.planName} · ${receipt.intervalLabel}`}
          mono={false}
        />
        {receipt.trialNote ? (
          <Row label="Trial" value={receipt.trialNote} mono={false} />
        ) : null}
      </dl>

      <div className="marketing-receipt-total mx-7 mt-6 py-5">
        <div className="flex min-w-0 items-baseline justify-between gap-6">
          <span className="shrink-0 text-xs font-semibold">Paid today</span>
          <span className="min-w-0 text-pretty break-words text-right font-mono text-lg font-semibold tabular-nums">
            {receipt.paidToday}
          </span>
        </div>
        {receipt.nextCharge ? (
          <p className="mt-2 text-xs text-[var(--marketing-ink)]/70">
            Then {receipt.nextCharge}
            {receipt.nextChargeOn
              ? ` on ${receipt.nextChargeOn}`
              : receipt.trialNote
                ? ", after the trial"
                : ""}
          </p>
        ) : null}
      </div>

      <dl className="space-y-3 px-7 py-6 text-xs text-[var(--marketing-ink)]/70">
        <Row label="Date" value={receipt.dateLabel} />
        {receipt.reference ? <Row label="Ref" value={receipt.reference} /> : null}
        {receipt.email ? (
          <Row label="Copy to" value={receipt.email} mono={false} />
        ) : null}
        <Row label="Collected by" value="Stripe" mono={false} />
        <Row label="Prices" value="GBP" mono={false} />
      </dl>

      <p className="px-7 pb-8 text-center text-xs text-[var(--marketing-ink)]/70">
        Cancel in <ManageBillingButton />.
      </p>
      <div className="marketing-receipt-tooth marketing-receipt-tooth-bottom" />
    </article>
  );
}

export function SubscribeReceiptPending({ error = false }: { error?: boolean }) {
  return (
    <article
      aria-busy={!error}
      aria-label={error ? "Receipt unavailable" : "Loading receipt"}
      className="marketing-receipt flex min-h-[22rem] w-full flex-col justify-center px-6 text-center text-sm text-[var(--marketing-ink)]"
    >
      <div className="marketing-receipt-tooth marketing-receipt-tooth-top" />
      <p
        role="status"
        aria-live="polite"
        className="flex-1 py-16 text-[var(--marketing-ink)]/70"
      >
        {error
          ? "Could not load the Stripe reference. Your plan is still with Stripe."
          : "Loading your slip."}
      </p>
      <div className="marketing-receipt-tooth marketing-receipt-tooth-bottom" />
    </article>
  );
}
