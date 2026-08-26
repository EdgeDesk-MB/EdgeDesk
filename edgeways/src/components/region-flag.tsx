"use client";

import { cn } from "@/lib/utils";
import {
  flagEmojiFromIso,
  flagLabelFromIso,
  racingRegionLabel,
  toIsoCountryCode,
} from "@/lib/geo/region";

export interface RegionFlagProps {
  /** API region/country code (GB, IRE, IE, UK, etc.) */
  code?: string | null;
  className?: string;
  /** Visual size */
  size?: "sm" | "md";
  /** Hide when code cannot be resolved */
  hideIfUnknown?: boolean;
  title?: string;
}

/**
 * Country flag from an API region/country code.
 * Uses Unicode regional indicators - no image CDN or local assets.
 */
export function RegionFlag({
  code,
  className,
  size = "sm",
  hideIfUnknown = true,
  title,
}: RegionFlagProps) {
  const iso = toIsoCountryCode(code);
  if (!iso) {
    if (hideIfUnknown) return null;
    return (
      <span className={cn("inline-block text-muted-foreground", className)} aria-hidden>
        ·
      </span>
    );
  }

  const emoji = flagEmojiFromIso(iso);
  const label = title ?? flagLabelFromIso(iso) ?? racingRegionLabel(code);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none",
        size === "sm" ? "text-[13px]" : "text-[16px]",
        className
      )}
      title={label}
      aria-label={label}
      role="img"
    >
      {emoji}
    </span>
  );
}

/** Global / international tournament flag (World Cup, etc.). */
export function GlobalFlag({
  className,
  size = "sm",
  title = "World",
}: {
  className?: string;
  size?: "sm" | "md";
  title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none",
        size === "sm" ? "text-[13px]" : "text-[16px]",
        className
      )}
      title={title}
      aria-label={title}
      role="img"
    >
      🌐
    </span>
  );
}
