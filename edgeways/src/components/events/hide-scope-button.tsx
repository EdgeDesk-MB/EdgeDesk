"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

export function HideScopeButton({
  hidden,
  label,
  onToggle,
  size = "header",
}: {
  hidden: boolean;
  label: string;
  onToggle: () => void;
  size?: "header" | "menu";
}) {
  const action = hidden ? `Show ${label}` : `Hide ${label}`;
  const Icon = hidden ? EyeOff : Eye;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={action}
          aria-pressed={hidden}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle();
          }}
          className={cn(
            "shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary-text",
            size === "menu" ? "size-7 max-sm:size-7" : "size-8 max-sm:size-8",
            hidden && "text-muted-foreground"
          )}
        >
          <Icon aria-hidden className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" sideOffset={6}>
        {action}
      </TooltipContent>
    </Tooltip>
  );
}
