"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
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
  FEEDBACK_KIND_LABELS,
  FEEDBACK_KINDS,
  type FeedbackDiagnostics,
  type FeedbackKind,
} from "@/lib/feedback/types";
import { ROADMAP_VERSION } from "@/content/roadmap";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const SUMMARY_COPY: Record<
  FeedbackKind,
  { label: string; placeholder: string; missing: string }
> = {
  bug: {
    label: "What's the bug?",
    placeholder: "Describe the problem in one line",
    missing: "Say what the bug is",
  },
  idea: {
    label: "Your idea",
    placeholder: "Describe the idea in one line",
    missing: "Add your idea",
  },
  other: {
    label: "Your note",
    placeholder: "Describe it in one line",
    missing: "Say what this is about",
  },
};

const KIND_HINTS: Record<FeedbackKind, string> = {
  bug: "What went wrong, and what did you expect instead?",
  idea: "What would make Edgeways more useful for you?",
  other: "Anything else you want to pass on.",
};

const THANKS: Record<FeedbackKind, { title: string; description: string }> = {
  bug: {
    title: "Thanks for reporting a bug",
    description: "We'll take a look.",
  },
  idea: {
    title: "Thanks for your suggestion",
    description: "We'll review it.",
  },
  other: {
    title: "Thanks for the note",
    description: "We'll take a look.",
  },
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

  async function submit() {
    const trimmedSummary = summary.trim();
    const trimmedDetails = details.trim();
    if (!trimmedSummary) {
      toast.error(SUMMARY_COPY[kind].missing);
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
          typeof data.error === "string" ? data.error : "Could not send feedback"
        );
      }

      toast.success(THANKS[kind].title, { description: THANKS[kind].description });
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
            Pick a type, describe it, then send it. We'll review every report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
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
                {SUMMARY_COPY[kind].label}
              </Label>
              <Input
                id={summaryId}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={160}
                placeholder={SUMMARY_COPY[kind].placeholder}
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

            <div>
              <Button
                type="submit"
                {...pagePrimaryButtonProps}
                disabled={saving}
                className="gap-1.5"
              >
                <Send className="size-3.5" aria-hidden />
                {saving ? "Sending…" : "Send feedback"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
