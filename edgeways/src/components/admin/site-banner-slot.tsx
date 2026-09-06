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

export function SiteBannerSlot({
  visible,
  motionReady,
  children,
}: {
  visible: boolean;
  motionReady: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0",
        motionReady && "transition-[grid-template-rows] motion-reduce:transition-none"
      )}
      style={{
        ...(motionReady ? collapseStyle : undefined),
        gridTemplateRows: visible ? "1fr" : "0fr",
      }}
      {...(!visible ? { "aria-hidden": true as const, inert: true } : {})}
    >
      <div className="min-h-0 overflow-hidden">
        {children ? (
          <div
            className={cn(
              motionReady &&
                "transition-[opacity,transform] motion-reduce:transition-none",
              visible ? "opacity-100" : "-translate-y-2 opacity-0"
            )}
            style={motionReady ? springStyle : undefined}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
