"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FADE_SEAM_PX,
  SCROLL_FADE_LENGTH_PX,
  SCROLL_FADE_STOP_AFTER_CLASS,
} from "@/components/ui/scroll-fade-edges";

/** Hour chip on a centred rule (`—— [13:00] ——`). */
const hourTagClass =
  "relative z-[1] shrink-0 rounded border border-border/70 bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground";

/** Day pill on a centred rule (`—— Today ——`), WhatsApp-style date stamp. */
const dayTagClass =
  "relative z-[1] shrink-0 rounded-full border border-border/70 bg-muted px-2.5 py-0.5 text-xs font-semibold tracking-wide text-foreground";

const stickyPlateClass =
  "relative sticky top-0 z-20 isolate overflow-visible bg-page py-2 max-sm:bg-background";

const stickyFadeClass = cn(
  // 1px into the plate only — do not climb into the pill. Pill sits z-[1]
  // above this wash. Mobile Home deck is `--background` (`--canvas`), not `--page`.
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-[calc(100%-var(--ew-scroll-fade-seam))] after:h-[var(--ew-scroll-fade-length)] after:bg-gradient-to-b after:from-page after:to-transparent after:content-[''] max-sm:after:from-background",
  SCROLL_FADE_STOP_AFTER_CLASS
);

function closestScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el && el !== document.documentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Centred day or hour stamp on a hairline. Used in Add bet Events and the
 * Home Live feed. Page lists (Campaigns, History) keep `ListDaySection`.
 * Live feed passes `sticky` so Today / Yesterday stay readable while rows
 * scroll under a matching plate (`--page` on desktop, `--background` below
 * `sm` for the mobile Home deck). The ScrollFadeEdges wash (`:after`) only
 * paints while the stamp is stuck at the feed top.
 */
export function ListDayRule({
  label,
  kind = "day",
  sticky = false,
  className,
}: {
  label: string;
  kind?: "day" | "hour";
  sticky?: boolean;
  className?: string;
}) {
  const stampRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useLayoutEffect(() => {
    if (!sticky) return;
    const stamp = stampRef.current;
    if (!stamp) return;
    const root = closestScrollParent(stamp);
    if (!root) return;

    const update = () => {
      const sr = root.getBoundingClientRect();
      const tr = stamp.getBoundingClientRect();
      setStuck(
        tr.top <= sr.top + 1 && tr.bottom > sr.top + 0.5 && root.scrollTop > 0.5
      );
    };

    update();
    root.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => {
      root.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [sticky]);

  return (
    <div
      ref={stampRef}
      className={cn(
        "flex items-center gap-2 px-1.5",
        sticky && stickyPlateClass,
        sticky && stuck && stickyFadeClass,
        className
      )}
      style={
        sticky
          ? {
              ["--ew-scroll-fade-length" as string]: `${SCROLL_FADE_LENGTH_PX}px`,
              ["--ew-scroll-fade-seam" as string]: `${FADE_SEAM_PX}px`,
            }
          : undefined
      }
      role="separator"
      aria-label={label}
    >
      <span className="h-px min-w-8 flex-1 bg-border" aria-hidden />
      <span className={kind === "day" ? dayTagClass : hourTagClass}>{label}</span>
      <span className="h-px min-w-8 flex-1 bg-border" aria-hidden />
    </div>
  );
}
