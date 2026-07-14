"use client";

/**
 * Appearance control - Light / Dark / System as a segmented control with
 * icons, replacing the old two-state dark-mode switch. `system` follows the
 * OS and is the honest default for a PWA that lives on a phone too.
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSelect({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const active = mounted ? (theme ?? "system") : "system";

  return (
    // Toggle-button group (aria-pressed), not fake radios - each button is a
    // plain tab stop, so no roving-tabindex machinery is owed.
    <div
      role="group"
      aria-label="Appearance"
      className={cn(
        "flex items-center gap-0.5 rounded-md border bg-muted/60 p-0.5",
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
            disabled={!mounted}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTheme(option.value)}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
