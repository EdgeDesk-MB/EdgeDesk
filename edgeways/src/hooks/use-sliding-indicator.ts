"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

export type SlidingIndicatorBox = {
  left: number;
  width: number;
  ready: boolean;
  /** Optional `data-plate` on the active child (segmented tab colours). */
  plate: string | null;
};

/**
 * Tracks an active child inside `containerRef` and returns left/width for a
 * sliding underline or pill. Re-measures on resize, scroll, and attribute
 * changes (e.g. data-state / aria-current).
 */
export function useSlidingIndicator(
  containerRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  deps: readonly unknown[] = []
): SlidingIndicatorBox {
  const [box, setBox] = useState<SlidingIndicatorBox>({
    left: 0,
    width: 0,
    ready: false,
    plate: null,
  });

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const active = root.querySelector(activeSelector) as HTMLElement | null;
    if (!active) {
      setBox((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    const rootRect = root.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const plateHost =
      active.closest<HTMLElement>('[data-slot="tabs-trigger"]') ?? active;
    // Round — subpixel churn from font/layout was restarting CSS transitions.
    // `left` is from the padding edge so it matches `position: absolute`.
    const next = {
      left: Math.round(
        activeRect.left - rootRect.left - root.clientLeft + root.scrollLeft
      ),
      width: Math.round(activeRect.width),
      ready: activeRect.width > 0,
      plate: plateHost.dataset.plate ?? null,
    };
    setBox((prev) =>
      prev.left === next.left &&
      prev.width === next.width &&
      prev.ready === next.ready &&
      prev.plate === next.plate
        ? prev
        : next
    );
  }, [activeSelector, containerRef]);

  useLayoutEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;

    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    for (const child of root.children) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    for (const label of root.querySelectorAll("[data-slot='tabs-trigger-label']")) {
      if (label instanceof HTMLElement) ro.observe(label);
    }

    const mo = new MutationObserver(() => measure());
    mo.observe(root, {
      attributes: true,
      subtree: true,
      // Don’t watch `class` — colour fades on the meta-nav were remeasuring
      // every frame of the fade and fighting the pill transition.
      attributeFilter: ["data-state", "data-active", "data-plate", "aria-current"],
      childList: true,
    });

    root.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      mo.disconnect();
      root.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps forwarded by caller
  }, [measure, ...deps]);

  return box;
}
