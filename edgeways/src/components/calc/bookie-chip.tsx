"use client";

import { bookieInitials, bookiePillStyle } from "@/lib/brands/bookies";
import { cn } from "@/lib/utils";

/** Brand-coloured monogram chip - not a real logo (spec §7.3). */
export function BookieChip({
  name,
  brandColor,
  className,
}: {
  name: string;
  brandColor?: string | null;
  className?: string;
}) {
  if (!name.trim()) return null;
  const style = bookiePillStyle(name, brandColor);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="flex size-5 items-center justify-center rounded border text-[9px] font-bold"
        style={{
          backgroundColor: style.bg,
          color: style.fg,
          borderColor: style.border,
        }}
      >
        {bookieInitials(name)}
      </span>
      <span className="text-sm">{name}</span>
    </span>
  );
}
