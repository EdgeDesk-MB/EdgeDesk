"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";

/**
 * Auth-surface 18+ step (EDGE-13 / EDGE-19+). Same wording as AgeGateDialog;
 * shown before Clerk SignUp so Google and email both require confirmation.
 */
export function AuthAgeConfirm({
  onConfirm,
  onDecline,
}: {
  onConfirm: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="w-full max-w-[400px] rounded-lg border border-white/10 bg-[#1a1a1a] p-6 text-[#f5f5f0] shadow-none">
      <div className="flex flex-col gap-3 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-[#FFC71E]">
          <ShieldCheck className="size-5 text-[#111111]" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Edgeways is for over-18s only
        </h1>
        <p className="text-sm text-[rgba(245,245,240,0.65)]">
          Edgeways tracks matched betting, staking against bookmaker promotions.
          You must be 18 or over to create an account.
        </p>
        <ResponsibleGamblingNote className="text-[rgba(245,245,240,0.55)] [&_a]:text-[#FFC71E]" />
      </div>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          className="h-10 w-full bg-[#FFC71E] font-semibold text-[#111111] hover:bg-[#ffd24d]"
          onClick={onConfirm}
        >
          Confirm I&apos;m 18 or over
        </Button>
        <Button
          variant="ghost"
          className="h-10 w-full text-[rgba(245,245,240,0.65)] hover:bg-white/5 hover:text-[#f5f5f0]"
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
    <div className="w-full max-w-[400px] rounded-lg border border-white/10 bg-[#1a1a1a] p-6 text-center text-[#f5f5f0]">
      <h1 className="text-xl font-semibold tracking-tight">
        Edgeways is for over-18s only
      </h1>
      <p className="mt-3 text-sm text-[rgba(245,245,240,0.65)]">
        You must be 18 or over to use Edgeways, so we can&apos;t create an
        account today. If someone else&apos;s gambling is affecting you, support
        is available.
      </p>
      <ResponsibleGamblingNote className="mt-3 text-[rgba(245,245,240,0.55)] [&_a]:text-[#FFC71E]" />
      <Link
        href="/"
        className="mt-6 inline-flex text-sm text-[#FFC71E] hover:text-[#ffd24d]"
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
