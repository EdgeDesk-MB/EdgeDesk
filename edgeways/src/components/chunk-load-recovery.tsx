"use client";

import { useEffect } from "react";
import {
  isNextChunkAssetUrl,
  recoverFromChunkLoadError,
  reloadAfterChunkFailure,
} from "@/lib/app-update/quiet-reload";

/**
 * An older tab asking for a chunk the new deploy no longer serves reloads
 * once, silently. The session guard stops it looping.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    function onRejection(event: PromiseRejectionEvent) {
      recoverFromChunkLoadError(event.reason);
    }

    function onError(event: Event) {
      if (event instanceof ErrorEvent) {
        recoverFromChunkLoadError(event.error ?? event.message);
        return;
      }
      const el = event.target;
      if (el instanceof HTMLScriptElement && isNextChunkAssetUrl(el.src)) {
        reloadAfterChunkFailure();
      } else if (
        el instanceof HTMLLinkElement &&
        el.rel === "stylesheet" &&
        isNextChunkAssetUrl(el.href)
      ) {
        reloadAfterChunkFailure();
      }
    }

    window.addEventListener("unhandledrejection", onRejection);
    // Resource load errors do not bubble, so listen in the capture phase.
    window.addEventListener("error", onError, true);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError, true);
    };
  }, []);

  return null;
}
