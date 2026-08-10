"use client";

/**
 * Keeps document.title in sync with the current desk route, and clears
 * push-style alert overlays when the user returns to the tab.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  onDocumentBecameHidden,
  onDocumentBecameVisible,
  setDeskDocumentTitleFromPathname,
} from "@/lib/document-title";

export function DocumentTitleController() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    setDeskDocumentTitleFromPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        onDocumentBecameHidden();
        return;
      }
      onDocumentBecameVisible();
      setDeskDocumentTitleFromPathname(pathname);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pathname]);

  return null;
}
