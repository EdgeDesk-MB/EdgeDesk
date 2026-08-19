"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PlacementOption } from "@/lib/offers/offer-track-bet";
import { ChevronRight, Layers, Puzzle, Target } from "lucide-react";

function scopeIcon(scope: PlacementOption["scope"]) {
  if (scope === "acca") return Layers;
  if (scope === "bet_builder") return Puzzle;
  return Target;
}

export function ScopePlaceChooserDialog({
  open,
  onOpenChange,
  options,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: PlacementOption[];
  onSelect: (option: PlacementOption) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Place this how?</DialogTitle>
          <DialogDescription>
            Pick the path you are placing now.
          </DialogDescription>
        </DialogHeader>

        <div
          role="listbox"
          aria-label="Placement path"
          className="overflow-hidden rounded-[var(--radius-button)] border border-border/70 bg-card"
        >
          {options.map((option, index) => {
            const Icon = scopeIcon(option.scope);
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                className={cn(
                  "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                  "hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none",
                  index > 0 && "border-t border-border/60"
                )}
                onClick={() => {
                  onOpenChange(false);
                  onSelect(option);
                }}
              >
                <Icon
                  className="size-4 shrink-0 text-primary-text"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
