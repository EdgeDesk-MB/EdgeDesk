"use client";

/**
 * PWA bootstrap (C4): registers the service worker and, on the first mobile
 * visit outside standalone mode, shows a dismissible once-only install
 * prompt. iOS has no install API, so it gets Share → Add to Home Screen
 * copy; Chromium gets a real Install button via beforeinstallprompt.
 */

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EdgeDeskLogoIcon } from "@/components/edge-desk-logo-icon";
import { useIsMobile } from "@/hooks/use-is-mobile";

const DISMISS_KEY = "edgedesk-install-prompt-dismissed";

type InstallOutcome = { outcome: "accepted" | "dismissed" };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallOutcome>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* dev/HTTP contexts without SW support */
      });
    }
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (isMobile !== true) return;
    // Deferred so the first paint settles before the prompt state flips.
    queueMicrotask(() => {
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        return;
      }
      if (isStandalone()) return;
      setIos(isIos());
      setVisible(true);
    });
  }, [isMobile]);

  if (!visible || isMobile !== true) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setVisible(false);
  };

  return (
    // Sits above the quick-log FAB (56px + its offset) so neither is obscured.
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+4.5rem)] z-30 flex items-center gap-3 rounded-lg border border-border/80 bg-popover p-3 text-sm text-popover-foreground shadow-lg"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-topbar">
        <EdgeDeskLogoIcon className="size-5 text-topbar-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Add EdgeDesk to your Home Screen</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {ios ? (
            <>
              Tap <Share className="inline size-3.5 align-text-bottom" role="img" aria-label="Share" /> then
              &ldquo;Add to Home Screen&rdquo; for the full-screen app and alerts.
            </>
          ) : (
            "Install for the full-screen app and alerts."
          )}
        </p>
      </div>
      {!ios && installEvent ? (
        <Button
          size="sm"
          className="h-9 shrink-0"
          onClick={async () => {
            await installEvent.prompt();
            dismiss();
          }}
        >
          Install
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss install prompt"
        onClick={dismiss}
        className="size-9 shrink-0 text-muted-foreground"
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
