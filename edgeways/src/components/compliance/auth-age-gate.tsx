"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";
import { LEGAL_PATHS } from "@/lib/legal/public";

/**
 * Auth-surface 18+ step (EDGE-13 / EDGE-19+). Shown before Clerk SignUp so
 * Google and email both require confirmation. Shares ResponsibleGamblingNote
 * with AgeGateDialog; auth copy is longer because this is account creation.
 */
export function AuthAgeConfirm({
  onConfirm,
  onDecline,
}: {
  onConfirm: () => void;
  onDecline: () => void;
}) {
  const [legalAccepted, setLegalAccepted] = useState(false);

  return (
    <div className="w-full max-w-[400px] rounded-lg border border-white/10 bg-[var(--marketing-panel-inset)] p-6 text-[var(--marketing-fg)] shadow-none">
      <div className="flex flex-col gap-3 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-[var(--marketing-brand)]">
          <ShieldCheck className="size-5 text-[var(--marketing-ink)]" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Edgeways is for over-18s only
        </h1>
        <p className="text-sm text-[color-mix(in_srgb,var(--marketing-fg)_65%,transparent)]">
          Edgeways tracks matched betting, staking against bookmaker promotions.
          You must be 18 or over to create an account.
        </p>
        <ResponsibleGamblingNote className="text-[color-mix(in_srgb,var(--marketing-fg)_55%,transparent)] [&_a]:text-[var(--marketing-brand)]" />
        <label className="flex cursor-pointer items-start gap-2 text-left text-sm text-[color-mix(in_srgb,var(--marketing-fg)_65%,transparent)]">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 rounded accent-[var(--marketing-brand)]"
            checked={legalAccepted}
            onChange={(e) => setLegalAccepted(e.target.checked)}
          />
          <span>
            I have read and agree to the{" "}
            <Link
              href={LEGAL_PATHS.terms}
              className="rounded-sm text-[var(--marketing-brand)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
              target="_blank"
              rel="noreferrer"
            >
              Terms of Service
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>{" "}
            and{" "}
            <Link
              href={LEGAL_PATHS.privacy}
              className="rounded-sm text-[var(--marketing-brand)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
            .
          </span>
        </label>
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          size="lg"
          className="h-10 w-full bg-[var(--marketing-brand)] font-semibold text-[var(--marketing-ink)] hover:opacity-90"
          disabled={!legalAccepted}
          onClick={onConfirm}
        >
          Confirm I&apos;m 18 or over
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="h-10 w-full text-[color-mix(in_srgb,var(--marketing-fg)_65%,transparent)] hover:bg-white/5 hover:text-[var(--marketing-fg)]"
          onClick={onDecline}
        >
          I&apos;m under 18
        </Button>
      </div>
    </div>
  );
}

export function AuthUnder18Blocked() {
  return (
    <div className="w-full max-w-[400px] rounded-lg border border-white/10 bg-[var(--marketing-panel-inset)] p-6 text-center text-[var(--marketing-fg)]">
      <h1 className="text-xl font-semibold tracking-tight">
        Edgeways is for over-18s only
      </h1>
      <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--marketing-fg)_65%,transparent)]">
        You must be 18 or over to use Edgeways, so we can&apos;t create an
        account today. If someone else&apos;s gambling is affecting you, support
        is available.
      </p>
      <ResponsibleGamblingNote className="mt-3 text-[color-mix(in_srgb,var(--marketing-fg)_55%,transparent)] [&_a]:text-[var(--marketing-brand)]" />
      <Link
        href="/"
        className="mt-6 inline-flex rounded-sm text-sm text-[var(--marketing-brand)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
      >
        Back to home
      </Link>
    </div>
  );
}

/** Age step first; render Clerk SignUp only after confirm (with timestamp). */
export function SignUpWithAgeGate({
  children,
}: {
  children: (ageConfirmedAt: number) => ReactNode;
}) {
  const [step, setStep] = useState<"age" | "form" | "under18">("age");
  const [ageConfirmedAt, setAgeConfirmedAt] = useState<number | null>(null);

  if (step === "under18") return <AuthUnder18Blocked />;
  if (step === "age" || ageConfirmedAt == null) {
    return (
      <AuthAgeConfirm
        onConfirm={() => {
          setAgeConfirmedAt(Date.now());
          setStep("form");
        }}
        onDecline={() => setStep("under18")}
      />
    );
  }
  return <>{children(ageConfirmedAt)}</>;
}
