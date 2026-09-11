"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { MessageSquarePlus, X } from "lucide-react";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { Button } from "@/components/ui/button";
import {
  FEEDBACK_PROMPT_DISMISS_KEY,
  FEEDBACK_SUBMITTED_KEY,
  betaFeedbackPromptVisible,
  readPromptTimestamp,
} from "@/lib/feedback/prompt-shared";
import { quietPanel } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Analytics are best-effort and never block the prompt. */
function capturePromptEvent(event: string): void {
  void import("posthog-js")
    .then(({ default: posthog }) => {
      try {
        posthog.capture(event);
      } catch {
        /* analytics optional */
      }
    })
    .catch(() => {
      /* analytics optional */
    });
}

function readStoredTimestamp(key: string): number | null {
  try {
    return readPromptTimestamp(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStoredTimestamp(key: string): void {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage optional */
  }
}

function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Slim beta feedback strip above the page panel. Signed-in desk users
 * only, never the public demo, never on /feedback itself. Dismissal
 * holds for a fortnight, sending feedback for a month. Reads
 * localStorage via useSyncExternalStore so the server never renders it.
 */
export function BetaFeedbackPrompt() {
  const pathname = usePathname();
  const { isLoaded, userId } = useAuth();
  const { active: demoActive } = usePublicDemo();
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const announcedRef = useRef(false);

  const eligible = useSyncExternalStore(
    subscribeToStorage,
    () =>
      isLoaded &&
      betaFeedbackPromptVisible({
        pathname,
        signedIn: Boolean(userId),
        demoActive,
        dismissedAt: readStoredTimestamp(FEEDBACK_PROMPT_DISMISS_KEY),
        submittedAt: readStoredTimestamp(FEEDBACK_SUBMITTED_KEY),
        now: Date.now(),
      }),
    () => false
  );
  const visible = eligible && !dismissedThisSession;

  useEffect(() => {
    if (visible && !announcedRef.current) {
      announcedRef.current = true;
      capturePromptEvent("beta_feedback_prompt_shown");
    }
  }, [visible]);

  if (!visible) return null;

  const dismiss = (
    event: "beta_feedback_prompt_clicked" | "beta_feedback_prompt_dismissed"
  ) => {
    writeStoredTimestamp(FEEDBACK_PROMPT_DISMISS_KEY);
    capturePromptEvent(event);
    setDismissedThisSession(true);
  };

  return (
    <div
      role="region"
      aria-label="Beta feedback"
      className={cn(
        quietPanel,
        "mb-3 flex items-center gap-2.5 px-3 py-2 max-sm:mt-3 max-sm:rounded-none max-sm:border-0"
      )}
    >
      <MessageSquarePlus className="size-4 shrink-0 text-primary-text" aria-hidden />
      <p className="min-w-0 flex-1 text-pretty break-words text-xs text-muted-foreground sm:text-sm">
        <span className="mr-1.5 font-medium text-foreground">Got 2 minutes?</span>
        You&rsquo;re
        one of the first people using Edgeways. Tell us what&rsquo;s working and
        what&rsquo;s missing.
      </p>
      <Link
        href="/feedback"
        onClick={() => dismiss("beta_feedback_prompt_clicked")}
        className="inline-flex shrink-0 items-baseline whitespace-nowrap rounded-sm text-xs font-semibold text-primary-text underline underline-offset-2 outline-none hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:text-sm"
      >
        Share feedback
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => dismiss("beta_feedback_prompt_dismissed")}
        aria-label="Dismiss feedback prompt"
        className="size-7 shrink-0 text-muted-foreground max-sm:size-8"
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
