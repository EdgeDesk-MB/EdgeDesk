"use client";

import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

/** Icon + label + switch, 12px between label and toggle (same as Lay odds / Lay stake). */
export function AddBetStripFlagToggle({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-3">
      <span className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-black/80 dark:text-white/95">
          {label}
        </span>
      </span>
      <Switch
        tone="onPanel"
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}
