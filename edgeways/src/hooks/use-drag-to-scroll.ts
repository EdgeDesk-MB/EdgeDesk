"use client";

import { useCallback, useEffect, useRef } from "react";

/** Pointer movement (px) before a mouse-down is treated as a drag, not a click. */
const DRAG_EPS = 4;

/** Light overshoot for settle - enough to read as "stick", not bouncy. */
const SETTLE_OVERSHOOT = 1.05;
const SETTLE_MS = 340;

function easeOutBack(t: number): number {
  const c1 = SETTLE_OVERSHOOT;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function parseScrollPaddingInlineStart(el: HTMLElement): number {
  const raw = getComputedStyle(el).scrollPaddingInlineStart;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Ideal scrollLeft so `child`'s start edge sits at the scroller's scroll-padding. */
function snapScrollLeftFor(el: HTMLElement, child: HTMLElement): number {
  const pad = parseScrollPaddingInlineStart(el);
  const delta = child.getBoundingClientRect().left - el.getBoundingClientRect().left - pad;
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  return Math.min(max, Math.max(0, el.scrollLeft + delta));
}

function snapChildren(el: HTMLElement): HTMLElement[] {
  const row = el.firstElementChild;
  if (!row) return [];
  return Array.from(row.children).filter((n): n is HTMLElement => n instanceof HTMLElement);
}

function nearestSnapChild(el: HTMLElement): HTMLElement | null {
  const children = snapChildren(el);
  if (children.length === 0) return null;

  const pad = parseScrollPaddingInlineStart(el);
  const origin = el.getBoundingClientRect().left + pad;
  let best = children[0]!;
  let bestDist = Infinity;
  for (const child of children) {
    const dist = Math.abs(child.getBoundingClientRect().left - origin);
    if (dist < bestDist) {
      bestDist = dist;
      best = child;
    }
  }
  return best;
}

function adjacentSnapChild(el: HTMLElement, direction: -1 | 1): HTMLElement | null {
  const children = snapChildren(el);
  if (children.length === 0) return null;
  const nearest = nearestSnapChild(el);
  if (!nearest) return null;
  const idx = children.indexOf(nearest);
  return children[idx + direction] ?? null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

export type DragToScrollOptions = {
  /**
   * On mouse-drag release, disable CSS snap briefly and ease to the nearest
   * snap child with a light overshoot so the settle reads as "sticking".
   */
  springSnap?: boolean;
  /**
   * While the pointer is over the strip, Left/Right arrows step to the
   * previous/next snap child (native arrows only work when focused).
   */
  hoverArrowKeys?: boolean;
};

/**
 * Click-and-drag horizontal panning for a scrollable element, mouse only -
 * touch/pen keep native scrolling. Spread the returned handlers onto the
 * scrollable element itself; a plain click still reaches whatever's
 * underneath, only a click that follows an actual drag is swallowed.
 *
 * Deliberately not using `setPointerCapture`: capturing the pointer makes
 * the browser retarget the compatibility mouseup/click events to this
 * element instead of whatever's under the cursor, breaking every click.
 */
export function useDragToScroll<T extends HTMLElement>(
  scrollRef: React.RefObject<T | null>,
  options: DragToScrollOptions = {}
) {
  const { springSnap = false, hoverArrowKeys = false } = options;
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const draggedRef = useRef(false);
  const hoveredRef = useRef(false);
  const snapTypeRef = useRef<string>("");
  const settleRafRef = useRef<number | null>(null);

  const cancelSettle = useCallback(() => {
    if (settleRafRef.current != null) {
      cancelAnimationFrame(settleRafRef.current);
      settleRafRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelSettle(), [cancelSettle]);

  const restoreSnap = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.style.scrollSnapType = snapTypeRef.current;
    snapTypeRef.current = "";
  }, [scrollRef]);

  const settleToChild = useCallback(
    (child: HTMLElement | null) => {
      const el = scrollRef.current;
      if (!el || !child) {
        restoreSnap();
        return;
      }

      if (springSnap && !snapTypeRef.current) {
        snapTypeRef.current = el.style.scrollSnapType;
        el.style.scrollSnapType = "none";
      }

      const from = el.scrollLeft;
      const to = snapScrollLeftFor(el, child);
      if (Math.abs(to - from) < 0.5) {
        el.scrollLeft = to;
        restoreSnap();
        return;
      }

      cancelSettle();
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / SETTLE_MS);
        el.scrollLeft = from + (to - from) * easeOutBack(t);
        if (t < 1) {
          settleRafRef.current = requestAnimationFrame(step);
        } else {
          settleRafRef.current = null;
          el.scrollLeft = to;
          restoreSnap();
        }
      };
      settleRafRef.current = requestAnimationFrame(step);
    },
    [cancelSettle, restoreSnap, scrollRef, springSnap]
  );

  const settleToNearest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    settleToChild(nearestSnapChild(el));
  }, [scrollRef, settleToChild]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;
      cancelSettle();
      if (springSnap) {
        // Free the drag from CSS snap so it does not fight the pointer.
        snapTypeRef.current = el.style.scrollSnapType;
        el.style.scrollSnapType = "none";
      }
      dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
      draggedRef.current = false;
    },
    [cancelSettle, scrollRef, springSnap]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      const el = scrollRef.current;
      if (!drag || !el) return;
      const dx = e.clientX - drag.startX;
      if (!draggedRef.current && Math.abs(dx) < DRAG_EPS) return;
      draggedRef.current = true;
      el.scrollLeft = drag.startScroll - dx;
    },
    [scrollRef]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    const wasDragging = draggedRef.current;
    dragRef.current = null;
    if (springSnap && wasDragging) {
      settleToNearest();
    } else if (springSnap) {
      restoreSnap();
    }
    // draggedRef stays set when we dragged - the click the browser fires
    // right after this mouseup is swallowed by onClickCapture below, then
    // cleared there.
  }, [restoreSnap, settleToNearest, springSnap]);

  const onPointerEnter = useCallback(() => {
    hoveredRef.current = true;
  }, []);

  const onPointerLeave = useCallback(() => {
    hoveredRef.current = false;
    endDrag();
  }, [endDrag]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // No setPointerCapture (keeps clicks working), so release when the pointer
  // leaves the strip or the button comes up anywhere in the window.
  useEffect(() => {
    const onWinUp = () => endDrag();
    window.addEventListener("pointerup", onWinUp);
    window.addEventListener("pointercancel", onWinUp);
    return () => {
      window.removeEventListener("pointerup", onWinUp);
      window.removeEventListener("pointercancel", onWinUp);
    };
  }, [endDrag]);

  useEffect(() => {
    if (!hoverArrowKeys) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!hoveredRef.current) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (dragRef.current) return;

      const el = scrollRef.current;
      if (!el) return;
      const direction: -1 | 1 = e.key === "ArrowLeft" ? -1 : 1;
      const child = adjacentSnapChild(el, direction);
      if (!child) return;

      e.preventDefault();
      cancelSettle();
      settleToChild(child);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelSettle, hoverArrowKeys, scrollRef, settleToChild]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerEnter,
    onPointerLeave,
    onPointerCancel: endDrag,
    onClickCapture,
  };
}
