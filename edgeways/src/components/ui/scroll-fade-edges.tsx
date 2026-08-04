"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDragToScroll } from "@/hooks/use-drag-to-scroll";
import { cn } from "@/lib/utils";

const SCROLL_EPS = 2;

/**
 * Wraps a scrolling container and fades its leading/trailing edge in and
 * out as it scrolls, so clipped content reads as "more to scroll" rather
 * than an abrupt crop. Vertical (top/bottom) by default; pass
 * `orientation="horizontal"` for a left/right row (tab strips, card decks).
 *
 * `dragToScroll` adds click-and-drag panning with the mouse (touch/pen keep
 * native scrolling) - a plain click still reaches its target underneath;
 * only a click that follows an actual drag is swallowed.
 *
 * With `springSnap`, Left/Right arrows step cards while the pointer is over
 * the strip (native arrow scrolling only works when the scroller is focused).
 */
export function ScrollFadeEdges({
  children,
  className,
  scrollClassName,
  fadeClassName,
  fadeSize = 28,
  orientation = "vertical",
  dragToScroll = false,
  springSnap = false,
}: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  /** Gradient source colour - defaults to page panel background */
  fadeClassName?: string;
  fadeSize?: number;
  orientation?: "vertical" | "horizontal";
  dragToScroll?: boolean;
  /** With dragToScroll: ease to the nearest snap child on mouse-drag release */
  springSnap?: boolean;
}) {
  const horizontal = orientation === "horizontal";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const canDrag = horizontal && dragToScroll;
  const drag = useDragToScroll(scrollRef, {
    springSnap: canDrag && springSnap,
    hoverArrowKeys: canDrag && springSnap,
  });

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (horizontal) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const canScroll = scrollWidth - clientWidth > SCROLL_EPS;
      setShowStart(canScroll && scrollLeft > SCROLL_EPS);
      setShowEnd(canScroll && scrollLeft + clientWidth < scrollWidth - SCROLL_EPS);
    } else {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight - clientHeight > SCROLL_EPS;
      setShowStart(canScroll && scrollTop > SCROLL_EPS);
      setShowEnd(canScroll && scrollTop + clientHeight < scrollHeight - SCROLL_EPS);
    }
  }, [horizontal]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);

    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [update, children]);

  const fadeBase = fadeClassName ?? "from-page";

  return (
    <div className={cn("relative min-h-0 w-full min-w-0 flex-1 overflow-hidden", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "box-border h-full min-h-0 w-full min-w-0",
          horizontal ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto",
          canDrag && "cursor-grab active:cursor-grabbing",
          scrollClassName
        )}
        onPointerDown={canDrag ? drag.onPointerDown : undefined}
        onPointerMove={canDrag ? drag.onPointerMove : undefined}
        onPointerUp={canDrag ? drag.onPointerUp : undefined}
        onPointerEnter={canDrag ? drag.onPointerEnter : undefined}
        onPointerLeave={canDrag ? drag.onPointerLeave : undefined}
        onPointerCancel={canDrag ? drag.onPointerCancel : undefined}
        onClickCapture={canDrag ? drag.onClickCapture : undefined}
      >
        {children}
      </div>
      {showStart ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10",
            horizontal
              ? "inset-y-0 left-0 bg-gradient-to-r to-transparent"
              : "inset-x-0 top-0 bg-gradient-to-b to-transparent",
            fadeBase
          )}
          style={horizontal ? { width: fadeSize } : { height: fadeSize }}
        />
      ) : null}
      {showEnd ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10",
            horizontal
              ? "inset-y-0 right-0 bg-gradient-to-l to-transparent"
              : "inset-x-0 bottom-0 bg-gradient-to-t to-transparent",
            fadeBase
          )}
          style={horizontal ? { width: fadeSize } : { height: fadeSize }}
        />
      ) : null}
    </div>
  );
}
