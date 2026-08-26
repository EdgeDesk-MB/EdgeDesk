"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDragToScroll } from "@/hooks/use-drag-to-scroll";
import { cn } from "@/lib/utils";

const SCROLL_EPS = 2;
/** Overhang past the clip so fractional zoom cannot leave a hairline. */
const FADE_OVERHANG_PX = 2;

const CHILD_SCROLLER_SELECTOR =
  "[data-radix-select-viewport], [data-slot='command-list']";

function resolveChildScroller(wrap: HTMLElement | null): HTMLElement | null {
  if (!wrap) return null;
  const marked = wrap.querySelector<HTMLElement>(CHILD_SCROLLER_SELECTOR);
  if (marked) return marked;
  // Radix Select Viewport also emits a <style> sibling — skip non-boxes.
  for (const node of wrap.children) {
    if (node instanceof HTMLElement && node.tagName !== "STYLE") return node;
  }
  return null;
}

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
 *
 * `scrollAsChild` overlays the fades on an existing scroller (Radix Select
 * viewport, cmdk list) instead of wrapping children in a new overflow box.
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
  scrollAsChild = false,
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
  /** First child is the scroller; do not create a nested overflow box. */
  scrollAsChild?: boolean;
}) {
  const horizontal = orientation === "horizontal";
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lockStartRef = useRef(pinScrollStart);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const canDrag = !scrollAsChild && horizontal && dragToScroll;
  const drag = useDragToScroll(scrollRef, {
    springSnap: canDrag && springSnap,
    hoverArrowKeys: canDrag && springSnap,
  });

  const getScroller = useCallback((): HTMLElement | null => {
    if (scrollAsChild) return resolveChildScroller(wrapRef.current);
    return scrollRef.current;
  }, [scrollAsChild]);

  const update = useCallback(() => {
    const el = getScroller();
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
  }, [getScroller, horizontal]);

  const pinToStart = useCallback(() => {
    const el = getScroller();
    if (!el) return;
    // Mandatory snap can bounce away from 0 in the same frame we set it.
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    if (horizontal) el.scrollLeft = 0;
    else el.scrollTop = 0;
    requestAnimationFrame(() => {
      const node = getScroller();
      if (!node) return;
      node.style.scrollSnapType = prevSnap;
      if (lockStartRef.current) {
        if (horizontal) node.scrollLeft = 0;
        else node.scrollTop = 0;
      }
      update();
    });
  }, [getScroller, horizontal, update]);

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
    const el = getScroller();
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

    // ResizeObserver delivers an initial observation on observe(), so the
    // first fade computation arrives with it rather than a sync setState here.
    const ro = new ResizeObserver(() => {
      if (lockStartRef.current) pinToStart();
      else update();
    });
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);
    if (scrollAsChild && wrapRef.current && wrapRef.current !== el) {
      ro.observe(wrapRef.current);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", releaseStartLock, { passive: true });
    el.addEventListener("touchstart", releaseStartLock, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", releaseStartLock);
      el.removeEventListener("touchstart", releaseStartLock);
    };
  }, [getScroller, update, children, horizontal, pinToStart, releaseStartLock, scrollAsChild]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      releaseStartLock();
      drag.onPointerDown?.(e);
    },
    [drag, releaseStartLock]
  );

  const fadeBase = fadeClassName ?? "from-page";
  const fadeLength = fadeSize + FADE_OVERHANG_PX;
  // Solid for the first few px — gradient interpolation at 0% is slightly
  // transparent and reads as a hairline on the clip edge.
  const fadeStop = "from-[6px]";

  return (
    <div
      ref={wrapRef}
      className={cn(
        // Overflow stays on the scroller. Hidden here clips the overhang
        // that covers subpixel seams at non-integer zoom.
        "relative min-h-0 w-full min-w-0",
        // Select/cmdk already own overflow — a flex parent would let
        // `flex: 1` on the Viewport collapse or fight max-height inherit.
        scrollAsChild ? "block" : "flex flex-1 flex-col",
        className
      )}
    >
      {scrollAsChild ? (
        children
      ) : (
        <div
          ref={scrollRef}
          className={cn(
            "box-border min-h-0 w-full min-w-0",
            // Vertical: flex-1 fills a constrained parent (dialog max-h, desk
            // column). `h-full` does not resolve when the wrapper is only
            // `flex-1` / `max-h-*` (height: auto), so the list grew, the
            // wrapper clipped, and nothing scrolled.
            horizontal
              ? "h-full overflow-x-auto overflow-y-hidden"
              : "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
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
      )}
      {showStart ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10",
            horizontal
              ? "-left-[2px] inset-y-0 bg-gradient-to-r to-transparent"
              : "-top-[2px] inset-x-0 bg-gradient-to-b to-transparent",
            fadeStop,
            fadeBase
          )}
          style={horizontal ? { width: fadeLength } : { height: fadeLength }}
        />
      ) : null}
      {showEnd ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-10",
            horizontal
              ? "-right-[2px] inset-y-0 bg-gradient-to-l to-transparent"
              : "-bottom-[2px] inset-x-0 bg-gradient-to-t to-transparent",
            fadeStop,
            fadeBase
          )}
          style={horizontal ? { width: fadeLength } : { height: fadeLength }}
        />
      ) : null}
    </div>
  );
}
