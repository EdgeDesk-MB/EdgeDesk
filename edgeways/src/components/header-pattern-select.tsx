"use client";

import { Layers } from "lucide-react";
import { useHeaderPattern } from "@/components/header-pattern-provider";
import { Label } from "@/components/ui/label";
import {
  HEADER_PATTERN_OPTIONS,
  normalizeHeaderPattern,
  type HeaderPatternId,
} from "@/lib/header-pattern";
import { cn } from "@/lib/utils";

export function HeaderPatternSelect({
  onPersist,
}: {
  /** Optional save to AppSettings (Settings page). */
  onPersist?: (patternId: HeaderPatternId) => void;
}) {
  const { patternId, setPatternId } = useHeaderPattern();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-muted-foreground" aria-hidden />
        <Label className="text-sm font-semibold">Header pattern</Label>
      </div>
      <p className="text-xs text-muted-foreground">Top bar texture.</p>
      <div
        role="listbox"
        aria-label="Header pattern"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
      >
        {HEADER_PATTERN_OPTIONS.map((opt) => {
          const selected = patternId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                const next = normalizeHeaderPattern(opt.id);
                setPatternId(next);
                onPersist?.(next);
              }}
              className={cn(
                "flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "border-foreground bg-muted/40"
                  : "border-border hover:border-foreground/40"
              )}
            >
              <span
                className="header-pattern-swatch relative block h-10 overflow-hidden rounded-md bg-[#111111]"
                data-header-pattern={
                  opt.id === "diagonal-lines" ? undefined : opt.id
                }
                aria-hidden
              />
              <span className="truncate text-xs font-medium text-foreground">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
