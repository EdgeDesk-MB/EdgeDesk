"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { favouriteStarIcon } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Pin } from "lucide-react";

export function FavouriteStar({
  favourite,
  label,
  onToggle,
  size = "header",
}: {
  favourite: boolean;
  label: string;
  onToggle: () => void;
  size?: "header" | "menu";
}) {
  const action = favourite ? `Unpin ${label}` : `Pin ${label}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={action}
          aria-pressed={favourite}
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
            size === "menu"
              ? "size-7 max-sm:size-7"
              : "h-8 w-4 max-sm:h-8 max-sm:w-4 justify-start px-0",
            favourite && "text-brand hover:text-brand"
          )}
        >
          <Pin aria-hidden className={favouriteStarIcon(favourite)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" sideOffset={6}>
        {action}
      </TooltipContent>
    </Tooltip>
  );
}
