"use client";

import { useEffect, useState } from "react";
import { preferMetaModifier } from "@/lib/keyboard/desk-shortcut-sheet";

/** `null` until mount so ⌘ / Ctrl does not flash the wrong platform. */
export function usePreferMetaModifier(): boolean | null {
  const [isMac, setIsMac] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMac(preferMetaModifier(navigator.userAgent));
  }, []);

  return isMac;
}
