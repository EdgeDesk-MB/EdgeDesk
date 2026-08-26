"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLiveDeskStarted } from "@/components/demo/use-live-desk-started";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import {
  assignLiveDesk,
  demoNoticeKind,
  demoNoticeStorageKey,
  signedInDemoCtaForStatus,
} from "@/lib/demo/public-demo";

function markNoticeSeen(kind: "guest" | "account") {
  try {
    sessionStorage.setItem(demoNoticeStorageKey(kind), "1");
  } catch {
    // private mode
  }
}

function noticeAlreadySeen(kind: "guest" | "account"): boolean {
  try {
    return sessionStorage.getItem(demoNoticeStorageKey(kind)) === "1";
  } catch {
    return false;
  }
}

/**
 * First look at the public demo desk. Guests get a “this is sample data”
 * note. Signed-in users get one action: set up, or return to their desk.
 */
export function DemoNoticeDialog({ suppressed = false }: { suppressed?: boolean }) {
  const { active } = usePublicDemo();
  const { isLoaded, isSignedIn } = useUser();
  const live = useLiveDeskStarted(isSignedIn === true);
  const signedInCta = signedInDemoCtaForStatus(live.status, live.started);
  const [open, setOpen] = useState(false);
  const kind = demoNoticeKind({
    publicDemo: active,
    signedIn: isSignedIn === true,
  });

  const ready =
    isLoaded === true &&
    !suppressed &&
    kind !== "none" &&
    !(kind === "account" && live.status === "loading");
  const [handledKind, setHandledKind] = useState<string | null>(null);
  if (ready && handledKind !== kind) {
    setHandledKind(kind);
    if (!noticeAlreadySeen(kind)) setOpen(true);
  }

  function dismiss() {
    if (kind !== "none") markNoticeSeen(kind);
    setOpen(false);
  }

  function goLive() {
    if (kind !== "none") markNoticeSeen(kind);
    assignLiveDesk(signedInCta?.path ?? "/desk");
  }

  if (kind === "none") return null;

  const account = kind === "account";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md" mobile="center">
        <DialogHeader>
          <DialogTitle>This is a demo desk</DialogTitle>
          <DialogDescription>
            {account
              ? live.status === "ready" && !live.started
                ? "You are signed in, but this is still sample data, not your bookies or bets."
                : "Sample data only. Your bookies and bets are on your own desk."
              : "A look at a filled desk. Nothing here is yours yet."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between">
          {account ? (
            <>
              <Button variant="ghost" onClick={dismiss}>
                Keep looking
              </Button>
              <Button size="lg" onClick={goLive}>
                {signedInCta?.label ?? "Back to your desk"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  dismiss();
                  window.location.assign("/sign-up");
                }}
              >
                Create a free account
              </Button>
              <Button size="lg" onClick={dismiss}>
                Keep looking
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
