"use client";

import { useSyncExternalStore } from "react";
import { preferMetaModifier } from "@/lib/keyboard/desk-shortcut-sheet";

function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return preferMetaModifier(navigator.userAgent);
}

function getServerSnapshot(): null {
  return null;
}

/** `null` until mount so ⌘ / Ctrl does not flash the wrong platform. */
export function usePreferMetaModifier(): boolean | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
