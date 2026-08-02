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

function nearestSnapChild(el: HTMLElement): HTMLElement | null {
  const row = el.firstElementChild;
  if (!row) return null;
  const children = Array.from(row.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  );
  if (children.length === 0) return null;

  const pad = parseScrollPaddingInlineStart(el);
  const origin = el.getBoundingClientRect().left + pad;
  let best = children[0];
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

export type DragToScrollOptions = {
  /**
   * On mouse-drag release, disable CSS snap briefly and ease to the nearest
   * snap child with a light overshoot so the settle reads as "sticking".
   */
  springSnap?: boolean;
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
  const { springSnap = false } = options;
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const draggedRef = useRef(false);
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

  const settleToNearest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const child = nearestSnapChild(el);
    if (!child) {
      restoreSnap();
      return;
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
  }, [cancelSettle, restoreSnap, scrollRef]);

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

  const onPointerUp = useCallback(() => {
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

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture };
}
