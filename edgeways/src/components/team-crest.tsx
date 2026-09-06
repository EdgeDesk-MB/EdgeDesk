"use client";

import { cn } from "@/lib/utils";

export interface TeamCrestProps {
  /** Logo URL from API-Football (club crest or national team badge) */
  src?: string | null;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "fill";
}

const CREST_PX = { sm: 16, md: 20, lg: 32, xl: 40, fill: 16 } as const;
const CREST_CLASS = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
  xl: "size-10",
  fill: "size-full",
} as const;

/**
 * Team crest / national badge from an upstream logo URL.
 * Renders nothing when the API did not provide a logo - no invented fallbacks.
 */
export function TeamCrest({ src, alt, className, size = "sm" }: TeamCrestProps) {
  if (!src) return null;
  const px = CREST_PX[size];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote API-Football CDN URLs
    <img
      src={src}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className={cn("shrink-0 object-contain", CREST_CLASS[size], className)}
    />
  );
}
