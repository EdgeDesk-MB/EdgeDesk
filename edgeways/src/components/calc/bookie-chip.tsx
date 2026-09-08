"use client";

import { useMemo } from "react";
import { useAppState } from "@/hooks/use-app-state";
import { bookiePillStyle } from "@/lib/brands/bookies";
import { cn } from "@/lib/utils";

/** 8px compact / 12px menu bookie mark. Hairline from `pillBorderColor`. */
export function BookieColourDot({
  name,
  brandColor,
  size = "sm",
}: {
  name: string;
  brandColor?: string | null;
  size?: "sm" | "md";
}) {
  if (!name.trim()) return null;
  const style = bookiePillStyle(name, brandColor);
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full border",
        size === "sm" ? "size-2" : "size-3"
      )}
      style={{ backgroundColor: style.bg, borderColor: style.border }}
      aria-hidden
    />
  );
}

/** Brand-colour dot plus bookie name (2UP Desk and compact venue rows). */
export function BookieChip({
  name,
  brandColor,
  className,
}: {
  name: string;
  brandColor?: string | null;
  className?: string;
}) {
  const trimmed = name.trim();
  const { state } = useAppState(0);
  const resolved = useMemo(() => {
    if (brandColor?.trim()) return brandColor.trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    return (
      state?.balances?.accounts?.find(
        (a) => a.name.toLowerCase() === key && a.brandColor?.trim()
      )?.brandColor?.trim() ?? null
    );
  }, [brandColor, trimmed, state?.balances?.accounts]);

  if (!trimmed) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={trimmed}>
      <BookieColourDot name={trimmed} brandColor={resolved} />
      <span className="text-sm">{trimmed}</span>
    </span>
  );
}
