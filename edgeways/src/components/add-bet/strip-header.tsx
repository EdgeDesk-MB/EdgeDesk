"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Optional leading cell, flag toggle left-aligned. */
export function AddBetStripHeader({
  leading,
  trailing,
  className,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  if (!leading) {
    return trailing ? (
      <div className={className}>{trailing}</div>
    ) : null;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 items-end gap-3 max-sm:grid-cols-1",
        className
      )}
    >
      <div className="min-w-0 text-pretty break-words">{leading}</div>
      {trailing ? <div>{trailing}</div> : null}
    </div>
  );
}
