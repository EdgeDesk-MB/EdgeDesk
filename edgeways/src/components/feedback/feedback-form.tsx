"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail } from "lucide-react";
import {
  pagePrimaryButtonProps,
  pageSecondaryButtonProps,
} from "@/components/layout/page-header-actions";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildFeedbackMailto,
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  FEEDBACK_TO_EMAIL,
  formatFeedbackBody,
  type FeedbackDiagnostics,
  type FeedbackKind,
} from "@/lib/feedback/types";
import { ROADMAP_VERSION } from "@/content/roadmap";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const KIND_HINTS: Record<FeedbackKind, string> = {
  bug: "What went wrong, and what did you expect instead?",
  idea: "What would make Edgeways more useful for you?",
  other: "Anything else you want to pass on.",
};

function collectDiagnostics(): FeedbackDiagnostics {
  return {
    appVersion: ROADMAP_VERSION.current,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    href: typeof window !== "undefined" ? window.location.href : "",
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "unknown",
  };
}

export function FeedbackForm() {
  const summaryId = useId();
  const detailsId = useId();
  const emailId = useId();

  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [diagnosticsPreview, setDiagnosticsPreview] = useState<FeedbackDiagnostics | null>(
    null
  );

  useEffect(() => {
    setDiagnosticsPreview(collectDiagnostics());
  }, []);

  async function submit(mode: "email" | "copy") {
    const trimmedSummary = summary.trim();
    const trimmedDetails = details.trim();
    if (!trimmedSummary) {
      toast.error("Add a short summary");
      return;
    }
    if (!trimmedDetails) {
      toast.error("Add a few details");
      return;
    }

    const diagnostics = collectDiagnostics();
    const draft = {
      kind,
      summary: trimmedSummary,
      details: trimmedDetails,
      replyEmail: replyEmail.trim() || null,
      diagnostics,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { report?: { id: number }; error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save feedback"
        );
      }

      setSentId(data.report?.id ?? null);

      if (mode === "copy") {
        await navigator.clipboard.writeText(formatFeedbackBody(draft));
        toast.success("Report copied", {
          description: "Paste it into an email or message whenever you like.",
        });
      } else {
        window.location.href = buildFeedbackMailto(draft);
        toast.success("Feedback saved", {
          description: `Opening your email app to send to ${FEEDBACK_TO_EMAIL}.`,
        });
      }

      setSummary("");
      setDetails("");
    } catch (e) {
      toast.error("Could not send feedback", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Send feedback</CardTitle>
          <CardDescription>
            Pick a type, describe it, then email a copy or keep it on this device.
            Diagnostics travel with the report so we can reproduce issues faster.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-normal text-muted-foreground">Type</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Feedback type">
              {FEEDBACK_KINDS.map((k) => (
                <FilterPill key={k} active={kind === k} onClick={() => setKind(k)}>
                  {FEEDBACK_KIND_LABELS[k]}
                </FilterPill>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={summaryId} className="text-xs font-normal text-muted-foreground">
              Summary
            </Label>
            <Input
              id={summaryId}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={160}
              placeholder={
                kind === "bug"
                  ? "e.g. Lay stake blank after OCR import"
                  : kind === "idea"
                    ? "e.g. Bulk settle from Racing Desk"
                    : "Short title for your note"
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={detailsId} className="text-xs font-normal text-muted-foreground">
              Details
            </Label>
            <textarea
              id={detailsId}
              rows={6}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={4000}
              placeholder={KIND_HINTS[kind]}
              className={cn(
                fieldControl,
                "min-h-[8rem] w-full resize-y px-2.5 py-2 text-sm outline-none"
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId} className="text-xs font-normal text-muted-foreground">
              Reply email <span className="text-muted-foreground/80">(optional)</span>
            </Label>
            <Input
              id={emailId}
              type="email"
              value={replyEmail}
              onChange={(e) => setReplyEmail(e.target.value)}
              maxLength={200}
              placeholder="If you want a reply"
              autoComplete="email"
            />
          </div>

          <details className="rounded-[var(--radius-button)] border border-border/60 bg-muted/30 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Included diagnostics
            </summary>
            <dl className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground/80">App</dt>
                <dd>{diagnosticsPreview?.appVersion ?? ROADMAP_VERSION.current}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground/80">Timezone</dt>
                <dd>{diagnosticsPreview?.timezone ?? "…"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-foreground/80">Page</dt>
                <dd className="break-all">{diagnosticsPreview?.href || "…"}</dd>
              </div>
            </dl>
          </details>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              {...pagePrimaryButtonProps}
              disabled={saving}
              className="gap-1.5"
              onClick={() => void submit("email")}
            >
              <Mail className="size-3.5" aria-hidden />
              Save and email
            </Button>
            <Button
              type="button"
              variant="outline"
              {...pageSecondaryButtonProps}
              disabled={saving}
              className="gap-1.5"
              onClick={() => void submit("copy")}
            >
              <Copy className="size-3.5" aria-hidden />
              Save and copy
            </Button>
          </div>

          {sentId != null ? (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-foreground" aria-hidden />
              Saved locally as report #{sentId}. Email opens your mail app; copy is
              handy when mailto is blocked.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
