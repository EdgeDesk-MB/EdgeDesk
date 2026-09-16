"use client";

import type { CSSProperties, ReactNode } from "react";
import { COLLAPSE_EASE, SPRING_DURATION_MS, SPRING_EASE } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

const collapseStyle = {
  transitionDuration: `${SPRING_DURATION_MS}ms`,
  transitionTimingFunction: COLLAPSE_EASE,
} satisfies CSSProperties;

const springStyle = {
  transitionDuration: `${SPRING_DURATION_MS}ms`,
  transitionTimingFunction: SPRING_EASE,
} satisfies CSSProperties;

/**
 * Height clip (0fr → 1fr) plus a short fade. Same tokens as the site banner
 * and side-nav sub-panels. Prefer this over mounting children with `&&`.
 */
export function CollapseReveal({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 transition-[grid-template-rows,margin-top] motion-reduce:transition-none",
        className
      )}
      style={{
        ...collapseStyle,
        gridTemplateRows: open ? "1fr" : "0fr",
      }}
      {...(!open ? { "aria-hidden": true as const, inert: true } : {})}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden",
          // 6px clip gutter when open so the 4px field ring is not cropped.
          // Negative margin cancels the padding so layout does not grow.
          open && "-mx-[6px] -mb-[6px] px-[6px] pb-[6px]"
        )}
      >
        <div
          className={cn(
            "transition-[opacity,transform] motion-reduce:transition-none",
            open ? "opacity-100" : "-translate-y-2 opacity-0"
          )}
          style={springStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
