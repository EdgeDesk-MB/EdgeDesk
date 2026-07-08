"use client";

import { bookieInitials, bookieStyle } from "@/lib/brands/bookies";
import { cn } from "@/lib/utils";

/** Brand-coloured monogram chip — not a real logo (spec §7.3). */
export function BookieChip({ name, className }: { name: string; className?: string }) {
  if (!name.trim()) return null;
  const style = bookieStyle(name);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="flex size-5 items-center justify-center rounded text-[9px] font-bold"
        style={{ backgroundColor: style.bg, color: style.fg }}
      >
        {bookieInitials(name)}
      </span>
      <span className="text-sm">{name}</span>
    </span>
  );
}
