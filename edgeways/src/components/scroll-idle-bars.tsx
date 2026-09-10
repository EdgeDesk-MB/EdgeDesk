"use client";

import { useEffect } from "react";
import {
  SCROLL_BAR_REVEAL_IDLE_MS,
  scrollBarRevealTarget,
} from "@/lib/ui/scroll-bar-reveal";

const SCROLLING_ATTR = "data-scrolling";

/**
 * Reveal thin thumbs only while a scroller is moving. Hover must not paint
 * a standing bar across the page.
 */
export function ScrollIdleBars() {
  useEffect(() => {
    const timers = new WeakMap<Element, number>();

    const onScroll = (event: Event) => {
      const scroller = scrollBarRevealTarget(event.target);
      if (!scroller) return;
      scroller.setAttribute(SCROLLING_ATTR, "");
      const prev = timers.get(scroller);
      if (prev) window.clearTimeout(prev);
      timers.set(
        scroller,
        window.setTimeout(() => {
          scroller.removeAttribute(SCROLLING_ATTR);
          timers.delete(scroller);
        }, SCROLL_BAR_REVEAL_IDLE_MS)
      );
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return null;
}
