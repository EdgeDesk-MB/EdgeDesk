"use client";

import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function TrackToggleButton({
  tracked,
  onTrack,
  onUntrack,
  appearance,
  className,
}: {
  tracked: boolean;
  onTrack?: () => void | Promise<void>;
  onUntrack?: () => void | Promise<void>;
  appearance: "icon" | "label";
  className?: string;
}) {
  const canAct = tracked ? Boolean(onUntrack) : Boolean(onTrack);

  function handleClick() {
    if (!canAct) return;
    if (tracked) void onUntrack?.();
    else void onTrack?.();
  }

  const label = tracked ? "Untrack" : "Track";
  const mark = (
    <Radio
      className={cn("size-4", tracked && "text-highlight")}
      aria-hidden
    />
  );

  if (appearance === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 text-muted-foreground/55 hover:text-foreground dark:text-muted-foreground",
              tracked && "text-highlight hover:text-highlight",
              className
            )}
            aria-label={label}
            aria-pressed={tracked}
            disabled={!canAct}
            onClick={(event) => {
              event.stopPropagation();
              handleClick();
            }}
          >
            {mark}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      {...pageSecondaryButtonProps}
      className={cn("group/track", tracked && "bg-muted", className)}
      aria-pressed={tracked}
      aria-label={label}
      disabled={!canAct}
      onClick={handleClick}
    >
      {mark}
      {tracked ? (
        <>
          <span className="group-hover/track:hidden group-focus-visible/track:hidden">
            Tracked
          </span>
          <span className="hidden group-hover/track:inline group-focus-visible/track:inline">
            Untrack
          </span>
        </>
      ) : (
        "Track"
      )}
    </Button>
  );
}
