"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Lucide Activity path - sparkline split at horizontal centre (y=12). */
const SPARKLINE_PATH =
  "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2";

const SPARKLINE_UP = "#22c55e";
const SPARKLINE_DOWN = "#ef4444";

export function EdgeDeskLogoIcon({ className }: { className?: string }) {
  const id = useId();
  const topClip = `${id}-top`;
  const bottomClip = `${id}-bottom`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5 shrink-0", className)}
      aria-hidden
    >
      <defs>
        <clipPath id={topClip}>
          <rect x="0" y="0" width="24" height="12" />
        </clipPath>
        <clipPath id={bottomClip}>
          <rect x="0" y="12" width="24" height="12" />
        </clipPath>
      </defs>
      <path
        d={SPARKLINE_PATH}
        stroke={SPARKLINE_UP}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#${topClip})`}
      />
      <path
        d={SPARKLINE_PATH}
        stroke={SPARKLINE_DOWN}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#${bottomClip})`}
      />
    </svg>
  );
}
