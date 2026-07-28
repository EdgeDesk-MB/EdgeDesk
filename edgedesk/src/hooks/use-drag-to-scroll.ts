"use client";

import { useCallback, useRef } from "react";

/** Pointer movement (px) before a mouse-down is treated as a drag, not a click. */
const DRAG_EPS = 4;

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
export function useDragToScroll<T extends HTMLElement>(scrollRef: React.RefObject<T | null>) {
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const draggedRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;
      dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
      draggedRef.current = false;
    },
    [scrollRef]
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
    dragRef.current = null;
    // draggedRef stays set - the click the browser fires right after this
    // mouseup is swallowed by onClickCapture below, then cleared there.
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture };
}
