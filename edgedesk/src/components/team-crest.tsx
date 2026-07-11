"use client";

import { cn } from "@/lib/utils";

export interface TeamCrestProps {
  /** Logo URL from API-Football (club crest or national team badge) */
  src?: string | null;
  alt: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Team crest / national badge from an upstream logo URL.
 * Renders nothing when the API did not provide a logo - no invented fallbacks.
 */
export function TeamCrest({ src, alt, className, size = "sm" }: TeamCrestProps) {
  if (!src) return null;
  const px = size === "sm" ? 16 : 20;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote API-Football CDN URLs
    <img
      src={src}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={cn(
        "shrink-0 object-contain",
        size === "sm" ? "size-4" : "size-5",
        className
      )}
    />
  );
}
