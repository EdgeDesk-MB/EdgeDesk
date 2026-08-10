"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasteCapture } from "@/components/paste-capture";
import { cn } from "@/lib/utils";
import { ChevronDown, ClipboardPaste } from "lucide-react";

/** Bar fill tracks readiness completion, not parse confidence. */
function readinessBarClass(complete: boolean): string {
  return complete ? "bg-success" : "bg-muted-foreground/45";
}

/** Toggle that matches SelectTrigger height (h-8) for toolbar rows. */
export function InlinePasteTrigger({
  open,
  onOpenChange,
  filledCount,
  panelId,
  buttonLabel = "Paste offer",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filledCount: number;
  panelId: string;
  buttonLabel?: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={open ? "secondary" : "outline"}
      size="sm"
      className={cn("h-8 shrink-0 gap-1.5", className)}
      onClick={() => onOpenChange(!open)}
      aria-expanded={open}
      aria-controls={panelId}
    >
      <ClipboardPaste className="size-3.5" />
      {buttonLabel}
      {filledCount > 0 ? (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {filledCount}
        </span>
      ) : null}
      <ChevronDown
        className={cn("size-3.5 opacity-70 transition-transform", open && "rotate-180")}
        aria-hidden
      />
    </Button>
  );
}

export function InlinePasteStrip({
  text,
  onTextChange,
  filledCount,
  confidence,
  playbookHint,
  readyCompleted,
  readyTotal,
  textLabel = "Offer text",
  placeholder,
  className,
  buttonLabel = "Paste offer",
  /** Controlled open (use with InlinePasteTrigger in a toolbar row). */
  open: openControlled,
  onOpenChange,
  /** Stable id shared with InlinePasteTrigger aria-controls. */
  panelId: panelIdProp,
  /** Hide the built-in button when the trigger sits elsewhere. */
  hideTrigger = false,
}: {
  text: string;
  onTextChange: (text: string) => void;
  filledCount: number;
  confidence?: "high" | "medium" | "low" | null;
  playbookHint?: string | null;
  /** Required-field readiness (e.g. 5 of 6). */
  readyCompleted?: number;
  readyTotal?: number;
  textLabel?: string;
  placeholder?: string;
  className?: string;
  buttonLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  panelId?: string;
  hideTrigger?: boolean;
}) {
  const autoId = useId();
  const panelId = panelIdProp ?? autoId;
  const hasText = Boolean(text.trim());
  const [openUncontrolled, setOpenUncontrolled] = useState(hasText);
  const open = openControlled ?? openUncontrolled;
  const setOpen = onOpenChange ?? setOpenUncontrolled;
  const prevHasText = useRef(hasText);
  const prevReadyComplete = useRef(false);

  const showReadiness =
    readyTotal != null &&
    readyTotal > 0 &&
    readyCompleted != null &&
    (hasText || filledCount > 0);
  const readyComplete =
    showReadiness && readyCompleted === readyTotal;

  // Open when paste/OCR text newly arrives; collapse once required fields are Ready.
  // Rising-edge only so a manual re-open while still Ready is not immediately closed.
  useEffect(() => {
    if (hasText && !prevHasText.current) {
      setOpen(true);
    }
    prevHasText.current = hasText;
  }, [hasText, setOpen]);

  useEffect(() => {
    if (readyComplete && !prevReadyComplete.current) {
      setOpen(false);
    }
    prevReadyComplete.current = readyComplete;
  }, [readyComplete, setOpen]);

  if (hideTrigger && !open && !hasText && filledCount === 0) {
    return null;
  }
  const readyPercent =
    showReadiness && readyTotal > 0
      ? Math.min(100, Math.round((readyCompleted / readyTotal) * 100))
      : 0;

  const primaryStatus = showReadiness
    ? readyComplete
      ? "Ready"
      : `${readyCompleted} of ${readyTotal} required fields`
    : filledCount > 0
      ? `Filled ${filledCount} field${filledCount === 1 ? "" : "s"}`
      : "No fields filled yet";

  const secondaryBits: string[] = [];
  if (showReadiness && filledCount > 0) {
    secondaryBits.push(
      `${filledCount} from paste`
    );
  }
  if (confidence) {
    secondaryBits.push(`${confidence} confidence`);
  }
  if (playbookHint) {
    secondaryBits.push(playbookHint);
  }

  const statusLine =
    hasText || filledCount > 0 ? (
      <div className="flex flex-col gap-1.5" aria-live="polite">
        {showReadiness ? (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={readyTotal}
            aria-valuenow={readyCompleted}
            aria-label={`Required fields ${readyCompleted} of ${readyTotal}`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-out",
                readinessBarClass(readyComplete)
              )}
              style={{ width: `${readyPercent}%` }}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <p
            className={cn(
              "text-xs font-medium",
              readyComplete ? "text-success" : "text-foreground"
            )}
          >
            {primaryStatus}
          </p>
          {secondaryBits.length > 0 ? (
            <p
              className={cn(
                "text-xs",
                confidence === "low" ? "text-warning" : "text-muted-foreground"
              )}
            >
              {secondaryBits.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">
        Paste fills matching fields. Add more screenshots anytime; your edits stay locked.
      </p>
    );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!hideTrigger ? (
        <div className="flex flex-wrap items-center gap-2">
          <InlinePasteTrigger
            open={open}
            onOpenChange={setOpen}
            filledCount={filledCount}
            panelId={panelId}
            buttonLabel={buttonLabel}
          />
          {!open && filledCount > 0 ? statusLine : null}
        </div>
      ) : null}

      {!open && hideTrigger && filledCount > 0 ? statusLine : null}

      {open ? (
        <div id={panelId} className="flex flex-col gap-2">
          <PasteCapture
            text={text}
            onTextChange={onTextChange}
            textLabel={textLabel}
            placeholder={placeholder}
            dense
          />
          {statusLine}
        </div>
      ) : null}
    </div>
  );
}
