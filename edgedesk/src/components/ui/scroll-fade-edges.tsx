"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SCROLL_EPS = 2;

export function ScrollFadeEdges({
  children,
  className,
  scrollClassName,
  fadeClassName,
  fadeHeight = 28,
}: {
  children: React.ReactNode;
  className?: string;
  scrollClassName?: string;
  /** Gradient source colour — defaults to page panel background */
  fadeClassName?: string;
  fadeHeight?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScroll = scrollHeight - clientHeight > SCROLL_EPS;
    setShowTop(canScroll && scrollTop > SCROLL_EPS);
    setShowBottom(canScroll && scrollTop + clientHeight < scrollHeight - SCROLL_EPS);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    const content = el.firstElementChild;
    if (content) ro.observe(content);

    el.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [update, children]);

  const fadeBase = fadeClassName ?? "from-page";

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden", className)}>
      <div ref={scrollRef} className={cn("h-full min-h-0 overflow-y-auto", scrollClassName)}>
        {children}
      </div>
      {showTop ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b to-transparent",
            fadeBase
          )}
          style={{ height: fadeHeight }}
        />
      ) : null}
      {showBottom ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t to-transparent",
            fadeBase
          )}
          style={{ height: fadeHeight }}
        />
      ) : null}
    </div>
  );
}
