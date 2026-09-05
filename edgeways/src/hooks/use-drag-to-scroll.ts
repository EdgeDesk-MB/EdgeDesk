"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  EW_PANNING_ATTR,
  adjacentSnapValue,
  clampScrollLeft,
  pickSnapTarget,
  pointerVelocityPxPerMs,
  prefersReducedMotion,
  projectScrollLeft,
  readHorizontalSnapPositions,
  type PointerSample,
} from "@/lib/ui/drag-scroll";

/** Pointer movement (px) before a mouse-down is treated as a drag, not a click. */
const DRAG_EPS = 4;
const SAMPLE_CAP = 8;

function panLayer(el: HTMLElement): HTMLElement | null {
  const row = el.firstElementChild;
  return row instanceof HTMLElement ? row : null;
}

function maxScrollLeft(el: HTMLElement): number {
  return Math.max(0, el.scrollWidth - el.clientWidth);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

type DragSession = {
  pointerId: number;
  startX: number;
  startScroll: number;
  max: number;
};

export type DragToScrollOptions = {
  springSnap?: boolean;
  hoverArrowKeys?: boolean;
};

/**
 * Mouse drag uses the same native overflow path as the trackpad: `scrollLeft`
 * 1:1 with the pointer. CSS snap is switched off for the gesture so it cannot
 * tug. Touch/pen keep native scrolling.
 */
export function useDragToScroll<T extends HTMLElement>(
  scrollRef: React.RefObject<T | null>,
  options: DragToScrollOptions = {}
) {
  const { springSnap = false, hoverArrowKeys = false } = options;
  const dragRef = useRef<DragSession | null>(null);
  const draggedRef = useRef(false);
  const hoveredRef = useRef(false);
  const samplesRef = useRef<PointerSample[]>([]);
  const swallowClickRef = useRef<((e: Event) => void) | null>(null);
  const unbindWindow = useRef<() => void>(() => {});
  const restoreTimerRef = useRef<number | null>(null);

  const clearSwallow = useCallback(() => {
    const swallow = swallowClickRef.current;
    if (!swallow) return;
    window.removeEventListener("click", swallow, true);
    swallowClickRef.current = null;
  }, []);

  const armClickSwallow = useCallback(() => {
    clearSwallow();
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      window.removeEventListener("click", swallow, true);
      swallowClickRef.current = null;
    };
    swallowClickRef.current = swallow;
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => {
      if (swallowClickRef.current === swallow) clearSwallow();
    }, 400);
  }, [clearSwallow]);

  const restoreSnap = useCallback((el: HTMLElement) => {
    const inner = panLayer(el);
    if (inner) inner.style.pointerEvents = "";
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    el.style.cursor = "";
    el.style.userSelect = "";
    el.style.removeProperty("-webkit-user-select");
    el.removeAttribute(EW_PANNING_ATTR);
  }, []);

  const afterSmoothScroll = useCallback(
    (el: HTMLElement) => {
      const done = () => {
        el.removeEventListener("scrollend", done);
        if (restoreTimerRef.current != null) {
          window.clearTimeout(restoreTimerRef.current);
          restoreTimerRef.current = null;
        }
        if (!dragRef.current) restoreSnap(el);
      };
      el.addEventListener("scrollend", done);
      restoreTimerRef.current = window.setTimeout(done, 450);
    },
    [restoreSnap]
  );

  const scrollToSnap = useCallback(
    (el: HTMLElement, target: number) => {
      const next = clampScrollLeft(target, maxScrollLeft(el));
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "";
      if (Math.abs(next - el.scrollLeft) < 0.5 || prefersReducedMotion()) {
        el.scrollLeft = next;
        restoreSnap(el);
        return;
      }
      el.scrollTo({ left: next, behavior: "smooth" });
      afterSmoothScroll(el);
    },
    [afterSmoothScroll, restoreSnap]
  );

  const finishGesture = useCallback(() => {
    const el = scrollRef.current;
    const drag = dragRef.current;
    dragRef.current = null;
    unbindWindow.current();
    if (!el || !drag) return;

    const wasDragging = draggedRef.current;
    const velocity = pointerVelocityPxPerMs(samplesRef.current);
    samplesRef.current = [];

    if (!wasDragging) {
      restoreSnap(el);
      return;
    }

    armClickSwallow();
    draggedRef.current = false;

    if (!springSnap) {
      restoreSnap(el);
      return;
    }

    const projected = projectScrollLeft(el.scrollLeft, velocity, drag.max);
    const target = pickSnapTarget(
      readHorizontalSnapPositions(el),
      el.scrollLeft,
      projected,
      velocity
    );
    scrollToSnap(el, target);
  }, [armClickSwallow, restoreSnap, scrollRef, scrollToSnap, springSnap]);

  const onWinMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !el || e.pointerId !== drag.pointerId) return;

    const dx = e.clientX - drag.startX;
    if (!draggedRef.current && Math.abs(dx) < DRAG_EPS) return;

    if (!draggedRef.current) {
      draggedRef.current = true;
      const inner = panLayer(el);
      if (inner) inner.style.pointerEvents = "none";
      el.style.cursor = "grabbing";
      el.setAttribute(EW_PANNING_ATTR, "");
    }

    if (e.cancelable) e.preventDefault();
    const samples = samplesRef.current;
    samples.push({ t: e.timeStamp, x: e.clientX });
    if (samples.length > SAMPLE_CAP) samples.shift();

    el.scrollLeft = clampScrollLeft(drag.startScroll - dx, drag.max);
  }, [scrollRef]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;

      clearSwallow();
      if (restoreTimerRef.current != null) {
        window.clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }

      draggedRef.current = false;
      samplesRef.current = [{ t: e.timeStamp, x: e.clientX }];
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      el.style.userSelect = "none";
      el.style.setProperty("-webkit-user-select", "none");
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: el.scrollLeft,
        max: maxScrollLeft(el),
      };

      const onUp = (ev: PointerEvent) => {
        if (dragRef.current && ev.pointerId !== dragRef.current.pointerId) return;
        finishGesture();
      };
      window.addEventListener("pointermove", onWinMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      unbindWindow.current = () => {
        window.removeEventListener("pointermove", onWinMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        unbindWindow.current = () => {};
      };
    },
    [clearSwallow, finishGesture, onWinMove, scrollRef]
  );

  const onPointerEnter = useCallback(() => {
    hoveredRef.current = true;
  }, []);

  const onPointerLeave = useCallback(() => {
    hoveredRef.current = false;
  }, []);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  useEffect(
    () => () => {
      unbindWindow.current();
      clearSwallow();
      if (restoreTimerRef.current != null) window.clearTimeout(restoreTimerRef.current);
    },
    [clearSwallow]
  );

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
      const target = adjacentSnapValue(
        readHorizontalSnapPositions(el),
        el.scrollLeft,
        direction
      );
      if (target == null) return;

      e.preventDefault();
      scrollToSnap(el, target);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoverArrowKeys, scrollRef, scrollToSnap]);

  return {
    onPointerDown,
    onPointerEnter,
    onPointerLeave,
    onClickCapture,
  };
}
