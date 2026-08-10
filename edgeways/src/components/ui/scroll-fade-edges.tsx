"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 *
 * `pinScrollStart` locks the scroller at its start edge until the user
 * interacts (wheel / pointer / touch). That beats browser scroll restoration,
 * scroll anchoring when cards are prepended, and snap-mandatory bounce on
 * Home Do next refresh.
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
  pinScrollStart = false,
  scrollStartKey,
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
  /** Keep the scroller pinned to its start edge on mount / key change */
  pinScrollStart?: boolean;
  /** Re-pin to start when this value changes (e.g. sort mode / leading card) */
  scrollStartKey?: string | number;
}) {
  const horizontal = orientation === "horizontal";
  const scrollRef = useRef<HTMLDivElement>(null);
  const lockStartRef = useRef(pinScrollStart);
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

  const pinToStart = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Mandatory snap can bounce away from 0 in the same frame we set it.
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    if (horizontal) el.scrollLeft = 0;
    else el.scrollTop = 0;
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.style.scrollSnapType = prevSnap;
      if (lockStartRef.current) {
        if (horizontal) node.scrollLeft = 0;
        else node.scrollTop = 0;
      }
      update();
    });
    update();
  }, [horizontal, update]);

  const releaseStartLock = useCallback(() => {
    lockStartRef.current = false;
  }, []);

  // Re-arm the start lock whenever the caller says the leading content changed.
  useLayoutEffect(() => {
    if (!pinScrollStart) {
      lockStartRef.current = false;
      return;
    }
    lockStartRef.current = true;
    pinToStart();
  }, [pinScrollStart, pinToStart, scrollStartKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      // Restoration / anchoring / snap often fire after first paint. While
      // locked, any drift off start is forced back; user interaction releases.
      if (lockStartRef.current) {
        if (horizontal && el.scrollLeft > SCROLL_EPS) {
          el.scrollLeft = 0;
          return;
        }
        if (!horizontal && el.scrollTop > SCROLL_EPS) {
          el.scrollTop = 0;
          return;
        }
      }
      update();
    };

    update();

    const ro = new ResizeObserver(() => {
      if (lockStartRef.current) pinToStart();
      else update();
    });
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", releaseStartLock, { passive: true });
    el.addEventListener("touchstart", releaseStartLock, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", releaseStartLock);
      el.removeEventListener("touchstart", releaseStartLock);
    };
  }, [update, children, horizontal, pinToStart, releaseStartLock]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      releaseStartLock();
      drag.onPointerDown?.(e);
    },
    [drag, releaseStartLock]
  );

  const fadeBase = fadeClassName ?? "from-page";

  return (
    <div className={cn("relative min-h-0 w-full min-w-0 flex-1 overflow-hidden", className)}>
      <div
        ref={scrollRef}
        className={cn(
          "box-border h-full min-h-0 w-full min-w-0",
          horizontal ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto",
          // Stop the browser shifting scrollLeft when cards are prepended
          // (lots/edge arriving after first paint).
          pinScrollStart && "[overflow-anchor:none]",
          canDrag && "cursor-grab active:cursor-grabbing",
          scrollClassName
        )}
        onPointerDown={canDrag || pinScrollStart ? onPointerDown : undefined}
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
