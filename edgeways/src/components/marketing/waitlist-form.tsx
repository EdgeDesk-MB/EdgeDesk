"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LEGAL_PATHS } from "@/lib/legal/public";

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function WaitlistForm({
  id = "waitlist",
  className,
}: {
  id?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status.kind === "submitting") return;

    setStatus({ kind: "submitting" });

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
      };

      if (!res.ok) {
        setStatus({
          kind: "error",
          message: body.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setStatus({
        kind: "success",
        message:
          body.status === "already_confirmed"
            ? "You're already on the list. We'll be in touch."
            : "Thanks! You'll hear from us soon :)",
      });
      setEmail("");
    } catch {
      setStatus({
        kind: "error",
        message: "Network error. Check your connection and try again.",
      });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <form
      id={id}
      onSubmit={onSubmit}
      className={cn("mx-auto flex w-full max-w-md flex-col gap-3", className)}
      noValidate
    >
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
        <label className="sr-only" htmlFor={`${id}-email`}>
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status.kind === "error") setStatus({ kind: "idle" });
          }}
          placeholder="you@email.com"
          disabled={submitting}
          className={cn(
            "box-border h-11 w-full min-w-0 rounded-[var(--radius-button)] border border-white/15 bg-white/5 px-3 text-base text-white sm:text-sm",
            "placeholder:text-white/55 outline-none",
            "focus-visible:border-[var(--marketing-brand)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--marketing-brand)_40%,transparent)]"
          )}
        />
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-button)] px-5",
            "bg-[var(--marketing-brand)] text-[var(--marketing-ink)]",
            "text-sm font-semibold outline-none transition-opacity",
            "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--marketing-brand)_50%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-ink)]",
            "sm:w-auto sm:shrink-0",
            submitting
              ? "cursor-not-allowed opacity-45"
              : "hover:opacity-90 active:opacity-80"
          )}
        >
          {submitting ? "Joining…" : "Get early beta access"}
        </button>
      </div>

      {status.kind === "success" ? (
        <p className="text-sm text-[var(--marketing-brand)]" role="status">
          {status.message}
        </p>
      ) : null}
      {status.kind === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          {status.message}
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-white/55">
        By joining you agree we can email you about the waitlist and launch.
        Read the{" "}
        <Link
          href={LEGAL_PATHS.privacy}
          className="rounded-sm text-[var(--marketing-brand)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
        >
          Privacy Policy
        </Link>
        . Unsubscribe any time.
      </p>
    </form>
  );
}
