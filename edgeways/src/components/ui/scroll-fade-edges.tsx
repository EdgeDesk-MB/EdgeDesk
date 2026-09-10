"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDragToScroll } from "@/hooks/use-drag-to-scroll";
import {
  adjacentSnapValue,
  readHorizontalSnapPositions,
  scrollToAdjacentSnap,
} from "@/lib/ui/drag-scroll";
import { SCROLL_BAR_REVEAL_IDLE_MS } from "@/lib/ui/scroll-bar-reveal";
import { cn } from "@/lib/utils";

const SCROLL_EPS = 2;
/** Default wash length; sticky day stamps reuse this via `SCROLL_FADE_LENGTH_PX`. */
export const SCROLL_FADE_SIZE_PX = 28;
/** Overhang past the clip so fractional zoom cannot leave a hairline. */
export const FADE_OVERHANG_PX = 2;
export const SCROLL_FADE_LENGTH_PX = SCROLL_FADE_SIZE_PX + FADE_OVERHANG_PX;
/** Pull every wash 1px over its seam so non-100% zoom cannot leak a sliver. */
export const FADE_SEAM_PX = 1;
/** Solid for the first few px — gradient interpolation at 0% reads as a hairline. */
export const SCROLL_FADE_STOP_CLASS = "from-[6px]";
/** Same stop on a `::after` wash (sticky day stamps). Keep in lockstep with `SCROLL_FADE_STOP_CLASS`. */
export const SCROLL_FADE_STOP_AFTER_CLASS = "after:from-[6px]";

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

const MODAL_FOCUS_SELECTOR =
  "[data-slot='dialog-content'], [data-slot='sheet-content'], [role='dialog'], [role='alertdialog']";

/** Dialogs portal under the cursor without pointerleave — don't pan the strip. */
function carouselKeysBlocked(target: EventTarget | null): boolean {
  const node = target instanceof Element ? target : null;
  if (node?.closest(MODAL_FOCUS_SELECTOR)) return true;
  const active = document.activeElement;
  if (active instanceof Element && active.closest(MODAL_FOCUS_SELECTOR)) return true;
  return Boolean(
    document.querySelector(
      "[data-slot='dialog-overlay'], [data-slot='dialog-content'][data-state='open'], [role='dialog'][aria-modal='true']"
    )
  );
}

/** Cover icon-sm (28px) at left-1 / right-1 so the circle stays in the wash. */
const STEP_BUTTON_FADE_PX = 36;

/**
 * Wraps a scrolling container and fades its leading/trailing edge in and
 * out as it scrolls, so clipped content reads as "more to scroll" rather
 * than an abrupt crop. Vertical (top/bottom) by default; pass
 * `orientation="horizontal"` for a left/right row (tab strips, card decks).
 *
 * `dragToScroll` adds click-and-drag panning with the mouse (touch/pen keep
 * native scrolling) - a plain click still reaches its target underneath;
 * only a click that follows an actual drag is swallowed. Use it on short
 * chrome (tab strips). Card decks should use `stepButtons` instead: overlay
 * prev/next chevrons when that direction has more content, plus trackpad /
 * wheel. Mouse-drag on glassy snap cards reads as hitchy.
 *
 * `stepButtons` + `springSnap` also step one snap child with Left/Right while
 * the pointer is over the strip (native arrow scrolling only works when the
 * scroller is focused). Chevron clicks leave CSS snap on.
 *
 * `pinScrollStart` locks the scroller at its start edge until the user
 * interacts (wheel / pointer / touch). That beats browser scroll restoration,
 * scroll anchoring when cards are prepended, and snap-mandatory bounce on
 * Home Do next refresh.
 *
 * `scrollAsChild` overlays the fades on an existing scroller (Radix Select
 * viewport, cmdk list) instead of wrapping children in a new overflow box.
 *
 * `edgeRule` paints a 1px top hairline above the wash so list chrome stays
 * put and content scrolls underneath. The wash still sits `-top-px` so
 * fractional zoom cannot leak a sliver under the rule. Vertical page fills
 * use this.
 */
export function ScrollFadeEdges({
  children,
  className,
  scrollClassName,
  fadeClassName,
  fadeSize = SCROLL_FADE_SIZE_PX,
  orientation = "vertical",
  dragToScroll = false,
  stepButtons = false,
  springSnap = false,
  pinScrollStart = false,
  scrollStartKey,
  scrollAsChild = false,
  startFade = true,
  fadeOnScroll = false,
  edgeRule = false,
  overlayScrollbar = false,
}: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  /** Gradient source colour - defaults to page panel background */
  fadeClassName?: string;
  fadeSize?: number;
  orientation?: "vertical" | "horizontal";
  dragToScroll?: boolean;
  /**
   * Overlay circular prev/next on a horizontal snap strip. Each control
   * shows only while that direction still has cards.
   */
  stepButtons?: boolean;
  /** With dragToScroll: ease to the nearest snap child on mouse-drag release */
  springSnap?: boolean;
  /** Keep the scroller pinned to its start edge on mount / key change */
  pinScrollStart?: boolean;
  /** Re-pin to start when this value changes (e.g. sort mode / leading card) */
  scrollStartKey?: string | number;
  /** First child is the scroller; do not create a nested overflow box. */
  scrollAsChild?: boolean;
  /**
   * Leading-edge fade. Turn off when a sticky section header already
   * occludes the start (Match events period bars, Home Live feed
   * `ListDayRule`).
   */
  startFade?: boolean;
  /**
   * Paint start/end washes only while the scroller is moving (same idle
   * as overlay thumbs). Use on page tapes so the first card is not
   * washed at rest.
   */
  fadeOnScroll?: boolean;
  /** Fixed top hairline; the list scrolls under it. Vertical only. */
  edgeRule?: boolean;
  /**
   * Floating thumb on the content (no track, no gutter). Pair with
   * `app-scroll-float` so the native bar is hidden. Vertical only.
   */
  overlayScrollbar?: boolean;
}) {
  const horizontal = orientation === "horizontal";
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lockStartRef = useRef(pinScrollStart);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const scrollIdleRef = useRef<number | null>(null);
  const [overlayThumb, setOverlayThumb] = useState<{
    top: number;
    height: number;
  } | null>(null);

  const canDrag = !scrollAsChild && horizontal && dragToScroll;
  const canStep = !scrollAsChild && horizontal && stepButtons;
  const hoveredRef = useRef(false);
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
      if (overlayScrollbar) {
        if (!canScroll) {
          setOverlayThumb(null);
        } else {
          const inset = 8;
          const travel = Math.max(0, clientHeight - inset * 2);
          const height = Math.max(24, (clientHeight / scrollHeight) * travel);
          const max = Math.max(0, travel - height);
          const top =
            inset + (scrollTop / (scrollHeight - clientHeight)) * max;
          setOverlayThumb({ top, height });
        }
      }
    }
  }, [getScroller, horizontal, overlayScrollbar]);

  const pinToStart = useCallback(() => {
    const el = getScroller();
    if (!el) return;
    if (el.hasAttribute("data-ew-panning")) return;
    // Mandatory snap can bounce away from 0 in the same frame we set it.
    // Two frames: wait for the reordered children to lay out, then restore.
    const prevSnap = el.style.scrollSnapType;
    el.style.scrollSnapType = "none";
    if (horizontal) el.scrollLeft = 0;
    else el.scrollTop = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const node = getScroller();
        if (!node || node.hasAttribute("data-ew-panning")) return;
        node.style.scrollSnapType = prevSnap;
        if (lockStartRef.current) {
          if (horizontal) node.scrollLeft = 0;
          else node.scrollTop = 0;
        }
        update();
      });
    });
  }, [getScroller, horizontal, update]);

  const releaseStartLock = useCallback(() => {
    lockStartRef.current = false;
  }, []);

  const fnsRef = useRef({ update, pinToStart, releaseStartLock, horizontal });
  useLayoutEffect(() => {
    fnsRef.current = { update, pinToStart, releaseStartLock, horizontal };
  });

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
      const { update: nextUpdate, horizontal: axis } = fnsRef.current;
      // Restoration / anchoring / snap often fire after first paint. While
      // locked, any drift off start is forced back; user interaction releases.
      if (lockStartRef.current) {
        if (axis && el.scrollLeft > SCROLL_EPS) {
          el.scrollLeft = 0;
          return;
        }
        if (!axis && el.scrollTop > SCROLL_EPS) {
          el.scrollTop = 0;
          return;
        }
      }
      if (el.hasAttribute("data-ew-panning")) return;
      if (fadeOnScroll) {
        setScrolling(true);
        if (scrollIdleRef.current != null) window.clearTimeout(scrollIdleRef.current);
        scrollIdleRef.current = window.setTimeout(() => {
          setScrolling(false);
          scrollIdleRef.current = null;
        }, SCROLL_BAR_REVEAL_IDLE_MS);
      }
      nextUpdate();
    };

    const ro = new ResizeObserver(() => {
      if (el.hasAttribute("data-ew-panning")) return;
      if (lockStartRef.current) fnsRef.current.pinToStart();
      else fnsRef.current.update();
    });
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);
    if (scrollAsChild && wrapRef.current && wrapRef.current !== el) {
      ro.observe(wrapRef.current);
    }

    const onWheel = () => fnsRef.current.releaseStartLock();
    const onTouch = () => fnsRef.current.releaseStartLock();

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouch, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouch);
      if (scrollIdleRef.current != null) {
        window.clearTimeout(scrollIdleRef.current);
        scrollIdleRef.current = null;
      }
    };
  }, [fadeOnScroll, getScroller, scrollAsChild]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      releaseStartLock();
      if (canDrag) drag.onPointerDown?.(e);
    },
    [canDrag, drag, releaseStartLock]
  );

  const step = useCallback(
    (direction: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      releaseStartLock();
      const snaps = readHorizontalSnapPositions(el);
      const next = adjacentSnapValue(snaps, el.scrollLeft, direction);
      scrollToAdjacentSnap(el, direction);
      if (next == null) return;
      const further = adjacentSnapValue(snaps, next, direction);
      if (further == null) el.focus({ preventScroll: true });
    },
    [releaseStartLock]
  );

  useEffect(() => {
    if (!canStep || !springSnap) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!hoveredRef.current) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (carouselKeysBlocked(e.target)) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return;
        if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      }
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canStep, springSnap, step]);

  const fadeBase = fadeClassName ?? "from-page";
  const edgeFadeSize = canStep ? Math.max(fadeSize, STEP_BUTTON_FADE_PX) : fadeSize;
  const fadeLength = edgeFadeSize + FADE_OVERHANG_PX;
  const fadeStop = SCROLL_FADE_STOP_CLASS;
  const fadesOpen = !fadeOnScroll || scrolling;

  return (
    <div
      ref={wrapRef}
      className={cn(
        // Do not clip here: fades sit -1px over the seam so fractional
        // zoom cannot leak a sliver. Sibling headers stay above (`z-10`).
        "relative min-h-0 w-full min-w-0",
        // Overlay thumb must sit above sticky period bars (`z-20`) and the
        // overflow paint layer. Isolate so those z-indexes stay in this wrap.
        overlayScrollbar && "isolate",
        // Select/cmdk already own overflow — a flex parent would let
        // `flex: 1` on the Viewport collapse or fight max-height inherit.
        scrollAsChild ? "block" : "flex flex-1 flex-col",
        className
      )}
      onPointerEnter={
        canStep
          ? () => {
              hoveredRef.current = true;
            }
          : undefined
      }
      onPointerLeave={
        canStep
          ? () => {
              hoveredRef.current = false;
            }
          : undefined
      }
    >
      {canStep ? (
        <>
          <StepChevron direction={-1} visible={showStart} onStep={step} />
          <StepChevron direction={1} visible={showEnd} onStep={step} />
        </>
      ) : null}
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
              ? "h-full overflow-x-auto overflow-y-clip overscroll-x-contain"
              : "relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
            // Stop the browser shifting scrollLeft when cards are prepended
            // (lots/edge arriving after first paint).
            pinScrollStart && "[overflow-anchor:none]",
            canDrag && "cursor-grab",
            canStep && "focus:outline-none",
            scrollClassName
          )}
          tabIndex={canStep ? -1 : undefined}
          onPointerDown={canDrag || pinScrollStart ? onPointerDown : undefined}
          onPointerEnter={canDrag ? drag.onPointerEnter : undefined}
          onPointerLeave={canDrag ? drag.onPointerLeave : undefined}
          onClickCapture={canDrag ? drag.onClickCapture : undefined}
        >
          {children}
        </div>
      )}
      {showStart && startFade && fadesOpen ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-[1]",
            horizontal
              ? "inset-y-0 bg-gradient-to-r to-transparent"
              : "bg-gradient-to-b to-transparent",
            fadeStop,
            fadeBase
          )}
          style={
            horizontal
              ? { width: fadeLength, left: -FADE_SEAM_PX }
              : {
                  height: fadeLength,
                  top: -FADE_SEAM_PX,
                  left: -FADE_SEAM_PX,
                  right: -FADE_SEAM_PX,
                }
          }
        />
      ) : null}
      {edgeRule && !horizontal ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] bg-border"
          style={{ height: FADE_SEAM_PX }}
        />
      ) : null}
      {showEnd && fadesOpen ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-[1]",
            horizontal
              ? "inset-y-0 bg-gradient-to-l to-transparent"
              : "bg-gradient-to-t to-transparent",
            fadeStop,
            fadeBase
          )}
          style={
            horizontal
              ? { width: fadeLength, right: -FADE_SEAM_PX }
              : {
                  height: fadeLength,
                  bottom: -FADE_SEAM_PX,
                  left: -FADE_SEAM_PX,
                  right: -FADE_SEAM_PX,
                }
          }
        />
      ) : null}
      {overlayScrollbar && overlayThumb ? (
        <div
          aria-hidden
          className="app-scroll-overlay-thumb pointer-events-none absolute inset-y-0 right-0 z-30 w-3"
        >
          <div
            className="absolute right-1 w-1.5 rounded-full bg-foreground/25"
            style={{ top: overlayThumb.top, height: overlayThumb.height }}
          />
        </div>
      ) : null}
    </div>
  );
}

function StepChevron({
  direction,
  visible,
  onStep,
}: {
  direction: -1 | 1;
  visible: boolean;
  onStep: (direction: -1 | 1) => void;
}) {
  const Icon = direction < 0 ? ChevronLeft : ChevronRight;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-20 flex items-center",
        direction < 0 ? "left-1" : "right-1",
        !visible && "invisible"
      )}
    >
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        rounded="full"
        aria-label={direction < 0 ? "Previous card" : "Next card"}
        aria-hidden={!visible}
        disabled={!visible}
        tabIndex={visible ? 0 : -1}
        className="pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation();
          onStep(direction);
        }}
      >
        <Icon className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
