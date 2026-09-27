"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  deskHasOpenHold,
  trackEditedFields,
  type EditedFieldTracker,
} from "@/lib/app-update/desk-busy";
import {
  UPDATE_RELOAD_COOLDOWN_MS,
  UPDATE_RELOAD_KEY,
  claimReloadGuard,
  quietReloadLinkTarget,
  reloadForUpdate,
  sessionReloadStore,
} from "@/lib/app-update/quiet-reload";
import {
  steppedAwayBeforeHiding,
  trackUserActivity,
} from "@/lib/app-update/user-activity";

/**
 * Applies a pending update with a full load at a safe moment: a link to
 * another page, a route change, or the tab going hidden after the user had
 * already left it idle. Never while a field is unsaved, a dialog is open or
 * a save is in flight. At most once per tab per cooldown window.
 */
export function useQuietUpdateReload(pending: boolean) {
  const pathname = usePathname();
  const pendingRef = useRef(pending);
  const trackerRef = useRef<EditedFieldTracker | null>(null);
  const pathRef = useRef(pathname);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    const tracker = trackEditedFields(document);
    trackerRef.current = tracker;
    const activity = trackUserActivity(document);

    function onVisibility() {
      if (document.visibilityState !== "hidden") {
        activity.markActive();
        return;
      }
      if (!steppedAwayBeforeHiding(activity.idleMs())) return;
      if (!claimSafeReload(pendingRef.current, tracker)) return;
      void reloadForUpdate();
    }

    function onClick(event: MouseEvent) {
      if (!pendingRef.current || event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link) return;
      const next = quietReloadLinkTarget(
        {
          href: link.href,
          target: link.getAttribute("target"),
          download: link.hasAttribute("download"),
        },
        window.location.href
      );
      if (!next || !claimSafeReload(pendingRef.current, tracker, true)) return;
      event.preventDefault();
      void reloadForUpdate(next);
    }

    document.addEventListener("visibilitychange", onVisibility);
    // Capture on window runs before the router's own click handler.
    window.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("click", onClick, true);
      tracker.dispose();
      activity.dispose();
      trackerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    const tracker = trackerRef.current;
    if (!tracker || !claimSafeReload(pendingRef.current, tracker)) return;
    void reloadForUpdate();
  }, [pathname]);
}

function claimSafeReload(
  pending: boolean,
  tracker: EditedFieldTracker,
  leavingPage = false
): boolean {
  if (!pending) return false;
  if (tracker.hasUnsavedInput() || deskHasOpenHold(document, leavingPage)) return false;
  return claimReloadGuard(
    sessionReloadStore(),
    UPDATE_RELOAD_KEY,
    UPDATE_RELOAD_COOLDOWN_MS,
    Date.now()
  );
}
