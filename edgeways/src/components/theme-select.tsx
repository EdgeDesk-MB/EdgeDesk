"use client";

/**
 * Appearance control — Light / Dark segmented toggle.
 * System/OS sync was dropped so the control fits the side-nav column
 * without truncating labels; explicit choice is clearer for a desk tool.
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: "light" | "dark"; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSelect({
  className,
  tone = "default",
  size = "default",
  value,
  onValueChange,
}: {
  className?: string;
  /** `topbar` = ink controls on the yellow app bar */
  tone?: "default" | "topbar";
  /** `compact` = icons only */
  size?: "default" | "compact";
  /** Controlled pick. When set, does not apply the theme until the parent does. */
  value?: "light" | "dark";
  onValueChange?: (theme: "light" | "dark") => void;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Collapse legacy "system" (or unset) onto the resolved light/dark face.
  const live: "light" | "dark" = !mounted
    ? "light"
    : theme === "dark" || theme === "light"
      ? theme
      : resolvedTheme === "dark"
        ? "dark"
        : "light";
  const active = value ?? live;
  const compact = size === "compact";
  const topbar = tone === "topbar";
  const applyLive = onValueChange == null;

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cn(
        "flex w-full min-w-0 items-center gap-0.5 rounded-md border p-0.5",
        topbar
          ? "border-[#111111]/15 bg-[#111111]/10"
          : "border-border bg-muted/60",
        className
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={`${option.label} appearance`}
            disabled={applyLive && !mounted}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[5px] text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              compact ? "size-7 flex-none px-0" : "px-2 py-1.5",
              selected
                ? topbar
                  ? "bg-[#111111] text-white"
                  : "bg-stat-tile-selected text-foreground dark:bg-background dark:text-foreground"
                : topbar
                  ? "text-[#111111]/70 hover:bg-[#111111]/10 hover:text-[#111111]"
                  : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              if (onValueChange) onValueChange(option.value);
              else setTheme(option.value);
            }}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {compact ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
