"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { favouriteStarIcon } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

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
  const action = favourite ? `Remove ${label} from saved` : `Add ${label} to saved`;

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
              : "size-8 max-sm:size-8",
            favourite && "text-brand hover:text-brand"
          )}
        >
          <Star aria-hidden className={favouriteStarIcon(favourite)} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" sideOffset={6}>
        {action}
      </TooltipContent>
    </Tooltip>
  );
}
