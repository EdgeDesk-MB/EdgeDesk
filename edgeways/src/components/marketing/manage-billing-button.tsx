"use client";

import { useState } from "react";
import { requestBillingPortal } from "@/lib/billing/open-portal";

export function ManageBillingButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function openPortal() {
    setFailed(false);
    setPending(true);
    try {
      const url = await requestBillingPortal();
      window.location.assign(url);
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openPortal()}
        disabled={pending}
        aria-busy={pending || undefined}
        className="underline decoration-[var(--marketing-ink)]/30 underline-offset-2 hover:decoration-[var(--marketing-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-ink)] disabled:opacity-60"
      >
        Manage billing
      </button>
      {failed ? (
        <span
          role="status"
          aria-live="polite"
          className="block pt-1 text-[var(--marketing-ink)]/70"
        >
          Could not open billing. Try again in a moment.
        </span>
      ) : null}
    </>
  );
}
