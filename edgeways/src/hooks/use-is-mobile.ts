"use client";

import { useEffect, useState } from "react";

/** Tailwind `sm` breakpoint - keep in step with the config. */
const SM_BREAKPOINT_PX = 640;

/**
 * Viewport gate for the mobile/desktop container split.
 * `null` until mounted (SSR/first paint) - render both containers with CSS
 * visibility during that window, then let exactly one stay mounted so hidden
 * copies don't poll, fetch or drift local state.
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SM_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}
