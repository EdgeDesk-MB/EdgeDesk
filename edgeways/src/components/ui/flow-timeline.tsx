"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FlowTimelineTone = "pending" | "current" | "done" | "lost" | "muted";

/**
 * Vertical status rail (delivery / order style): 2px line + dots.
 * Dot centres align with the first line of step content (text-sm).
 */
export function FlowTimeline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <ol className={cn("relative m-0 list-none p-0", className)}>{children}</ol>;
}

export function FlowTimelineStep({
  tone,
  children,
  className,
  first = false,
  last = false,
}: {
  tone: FlowTimelineTone;
  children: React.ReactNode;
  className?: string;
  /** Breathing room above the first step (8px) */
  first?: boolean;
  /** Hide the line below the final step */
  last?: boolean;
}) {
  return (
    <li className={cn("relative flex gap-2.5", first && "pt-2", className)}>
      <div className="relative flex w-4 shrink-0 flex-col items-center">
        {/* h-5 matches text-sm line box so the dot sits on the selection title */}
        <div className="relative z-[1] flex h-5 w-full items-center justify-center">
          <span
            className={cn(
              "flex size-3.5 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-background",
              tone === "done" && "border-success text-success",
              tone === "current" && "border-primary",
              tone === "pending" && "border-warning",
              tone === "lost" && "border-destructive bg-destructive/15 text-destructive",
              tone === "muted" && "border-muted-foreground/40"
            )}
            aria-hidden
          >
            {tone === "done" ? (
              <Check className="size-2.5 stroke-[2.75]" />
            ) : tone === "lost" ? (
              <X className="size-2.5 stroke-[2.75]" />
            ) : null}
          </span>
        </div>
        {!last ? (
          <span className="w-[2px] min-h-4 flex-1 bg-border" aria-hidden />
        ) : null}
      </div>
      {/* 24px between 3-row legs so the status line does not collide with the next title */}
      <div className={cn("min-w-0 flex-1", last ? "pb-4" : "pb-6")}>{children}</div>
    </li>
  );
}
