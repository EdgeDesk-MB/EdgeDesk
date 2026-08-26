"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import {
  ReferralCodeChip,
  useReferralShare,
} from "@/components/referrals/referral-share-panel";
import {
  isReferralPromptHidden,
  markReferralPromptDismissed,
  REFERRAL_PITCH,
  shouldOpenReferralPrompt,
  snoozeReferralPrompt,
} from "@/lib/referrals/prompt";
import { dialogTitleIcon, sectionDescription } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function ReferAFriendDialogBody({
  onNotNow,
  onCopied,
}: {
  onNotNow: () => void;
  onCopied: () => void;
}) {
  const { referral, failed, retry, copyLink } = useReferralShare("home-prompt");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <Gift className={cn(dialogTitleIcon, "text-edge")} aria-hidden />
          Refer a friend
        </DialogTitle>
        <DialogDescription>
          Share a link. They save, you get £10 credit.
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-w-0 flex-col gap-2">
        <p className={sectionDescription}>{REFERRAL_PITCH}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ReferralCodeChip code={referral?.code ?? null} failed={failed} />
          {failed ? (
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          ) : null}
        </div>
        {failed ? (
          <p className={sectionDescription} role="alert">
            Could not load your referral code.
          </p>
        ) : null}
        {referral && !failed ? (
          <p className={cn(sectionDescription, "select-all break-all")}>
            {referral.shareUrl}
          </p>
        ) : null}
      </div>
      <DialogFooter className="sm:justify-between">
        <Button variant="ghost" size="lg" onClick={onNotNow}>
          Not now
        </Button>
        {failed ? null : (
          <Button
            variant="edge"
            size="lg"
            disabled={!referral}
            aria-busy={!referral || undefined}
            onClick={() => {
              void copyLink().then((copied) => {
                if (copied) onCopied();
              });
            }}
          >
            {referral ? "Copy referral link" : "Loading referral link"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

/**
 * Homepage prompt for the referral loop. Overlay / close snoozes this visit.
 * Not now and a successful copy dismiss it until they clear storage.
 */
export function ReferAFriendDialog({
  suppressed = false,
}: {
  suppressed?: boolean;
}) {
  const pathname = usePathname();
  const { active: publicDemo } = usePublicDemo();
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const persistRef = useRef(false);
  const userId = user?.id ?? null;
  const hidden =
    typeof window === "undefined" || isReferralPromptHidden(userId);

  const eligible =
    isLoaded === true &&
    shouldOpenReferralPrompt({
      pathname,
      signedIn: isSignedIn === true,
      publicDemo,
      suppressed,
      hidden,
    });

  if (eligible !== open) {
    persistRef.current = false;
    setOpen(eligible);
  }

  function persistDismiss() {
    persistRef.current = true;
    markReferralPromptDismissed(userId);
    setOpen(false);
  }

  function notNow() {
    persistDismiss();
    toast("You can copy this later from Settings.");
  }

  if (!eligible && !open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (!persistRef.current) snoozeReferralPrompt(userId);
        setOpen(false);
      }}
    >
      <DialogContent className="sm:max-w-md" mobile="center">
        <ReferAFriendDialogBody onNotNow={notNow} onCopied={persistDismiss} />
      </DialogContent>
    </Dialog>
  );
}
