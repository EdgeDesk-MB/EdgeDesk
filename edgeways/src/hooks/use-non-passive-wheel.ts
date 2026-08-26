"use client";

import { useCallback, useEffect, useRef } from "react";

type WheelLike = { deltaY: number; preventDefault: () => void };

/**
 * Bind `wheel` with `{ passive: false }` so `preventDefault` can stop the
 * native number-input increment. React `onWheel` is passive, which is why
 * lay-odds fields used to step 6 → 6.1 instead of the exchange tick 6 → 6.2.
 *
 * Only fires while the element is focused, so hovering a field does not steal
 * page scroll.
 */
export function useNonPassiveWheel<T extends HTMLElement>(
  onWheel: ((e: WheelLike) => void) | null | undefined
): (node: T | null) => void {
  const onWheelRef = useRef(onWheel);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onWheelRef.current = onWheel;
  }, [onWheel]);

  const setRef = useCallback((node: T | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!node) return;

    const listener = (e: WheelEvent) => {
      if (!onWheelRef.current) return;
      if (document.activeElement !== node) return;
      onWheelRef.current(e);
    };
    node.addEventListener("wheel", listener, { passive: false });
    cleanupRef.current = () => node.removeEventListener("wheel", listener);
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return setRef;
}
