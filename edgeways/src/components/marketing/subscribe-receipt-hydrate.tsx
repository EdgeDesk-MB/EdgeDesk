"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  SubscribeReceipt,
  SubscribeReceiptPending,
} from "@/components/marketing/subscribe-receipt";
import { receiptNextStep, type SubscribeReceiptView } from "@/lib/billing/receipt-view";
import { writeSetupUpgradeConfirmed } from "@/lib/onboarding-setup-upgrade";

export function SubscribeReceiptHydrate({
  sessionId,
  initial,
  from,
  paidPlan,
}: {
  sessionId: string | undefined;
  initial: SubscribeReceiptView | null;
  from?: "setup" | null;
  paidPlan?: "core" | "edge" | null;
}) {
  const { user } = useUser();
  const [receipt, setReceipt] = useState(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void fetch(`/api/billing/session?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as SubscribeReceiptView;
      })
      .then((next) => {
        if (cancelled) return;
        if (next?.planName) {
          setReceipt(next);
          setFailed(false);
          return;
        }
        setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (from !== "setup" || !paidPlan) return;
    writeSetupUpgradeConfirmed(paidPlan, user?.id);
  }, [from, paidPlan, user?.id]);

  const headline = receipt?.headline ?? "You're in";
  const nextStep =
    from === "setup"
      ? receiptNextStep("setup")
      : (receipt?.nextStep ??
        (sessionId
          ? receiptNextStep()
          : "We could not find that order. If you were charged, it will still show in Stripe."));

  return (
    <>
      <p className="text-sm text-white/55">Subscription confirmed</p>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-white">
        {headline}
      </h1>
      <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-white/60">
        {nextStep}
      </p>
      {receipt || sessionId ? (
        <div className="marketing-receipt-enter mt-12 w-full max-w-[22rem]">
          {receipt ? (
            <SubscribeReceipt receipt={receipt} />
          ) : failed ? (
            <SubscribeReceiptPending error />
          ) : (
            <SubscribeReceiptPending />
          )}
        </div>
      ) : null}
    </>
  );
}
