"use client";

import { useEffect } from "react";

const DESK_SURFACE_CLASS = "desk-surface";

/**
 * Locks html/body overflow for desk routes (see globals.css html.desk-surface).
 * Marketing pages omit this, so the document can scroll normally.
 */
export function DeskSurfaceLock() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(DESK_SURFACE_CLASS);
    return () => {
      root.classList.remove(DESK_SURFACE_CLASS);
    };
  }, []);

  return null;
}
