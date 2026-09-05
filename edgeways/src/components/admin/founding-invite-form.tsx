"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FoundingInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setFieldError(null);
    try {
      const res = await fetch("/api/admin/founding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = (await res.json()) as {
        error?: string;
        status?: "granted" | "already_eligible";
        email?: string;
      };
      if (!res.ok) {
        setFieldError(body.error ?? "Could not add that email.");
        return;
      }
      if (body.status === "already_eligible") {
        toast.message("Already on the Founding list.");
        return;
      }
      toast.success(
        "On the Founding list. They subscribe to Edge monthly with this email."
      );
      setEmail("");
      router.refresh();
    } catch (error) {
      setFieldError(
        error instanceof Error ? error.message : "Could not add that email."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex min-w-0 max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="founding-invite-email">Email</Label>
        <Input
          id="founding-invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          placeholder="friend@example.com"
          name="email"
          required
          value={email}
          disabled={busy}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? "founding-invite-email-error" : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldError) setFieldError(null);
          }}
        />
        {fieldError ? (
          <p id="founding-invite-email-error" className="text-xs text-destructive">
            {fieldError}
          </p>
        ) : null}
      </div>
      <Button type="submit" {...pagePrimaryButtonProps} className="shrink-0" disabled={busy}>
        {busy ? "Adding…" : "Add to Founding list"}
      </Button>
    </form>
  );
}
