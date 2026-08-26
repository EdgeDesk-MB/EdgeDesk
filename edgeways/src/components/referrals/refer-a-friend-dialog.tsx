"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { ReferAFriendArt } from "@/components/referrals/refer-a-friend-art";
import { useReferralShare } from "@/components/referrals/referral-share-panel";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { useAppState } from "@/hooks/use-app-state";
import {
  hasReferralSuccessMoment,
  isReferralPromptHidden,
  isReferralSubscriber,
  markReferralPromptDismissed,
  shouldOpenReferralPrompt,
  snoozeReferralPrompt,
} from "@/lib/referrals/prompt";
import { captionHeading, sectionDescription } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const SIDES = [
  {
    who: "They get",
    figure: "50%",
    detail: "Off their first paid month",
  },
  {
    who: "You get",
    figure: "£10",
    detail: "On their first payment",
  },
] as const;

const PLATE_CONTROL = "h-11 max-sm:h-11 rounded-[var(--radius-button)]";

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
      <div className="shrink-0 bg-edge text-edge-foreground">
        <div className="relative">
          <DialogClose
            className={cn(
              "absolute top-4 right-3 z-10 flex size-8 items-center justify-center rounded-lg",
              "text-edge-foreground/85 transition-colors",
              "hover:bg-edge-foreground/10 hover:text-edge-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-edge-foreground/50"
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
            <ReferAFriendArt className="h-[6.5rem] w-full max-w-[15rem]" />
            <DialogTitle className="mt-3 text-center text-edge-foreground">
              Refer a friend
            </DialogTitle>
            <DialogDescription className="mt-1 text-center text-edge-foreground/85">
              Share a link. They save, you get £10 credit.
            </DialogDescription>
            <div className="mt-4 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
              <code
                aria-busy={(!failed && !referral) || undefined}
                aria-label={
                  failed
                    ? "Referral code unavailable"
                    : referral
                      ? `Your referral code, ${referral.code}`
                      : "Loading referral code"
                }
                className={cn(
                  PLATE_CONTROL,
                  "inline-flex min-w-0 flex-1 items-center justify-center bg-edge-foreground/12 px-3 font-mono text-sm font-bold tracking-widest text-edge-foreground"
                )}
              >
                {failed ? "----" : (referral?.code ?? "…")}
              </code>
              {failed ? (
                <Button
                  variant="ghost"
                  className={cn(
                    PLATE_CONTROL,
                    "w-full border border-edge-foreground/30 bg-transparent text-edge-foreground sm:w-auto",
                    "hover:bg-edge-foreground/10 hover:text-edge-foreground",
                    "dark:hover:bg-edge-foreground/10 dark:hover:text-edge-foreground"
                  )}
                  onClick={retry}
                >
                  Try again
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className={cn(
                    PLATE_CONTROL,
                    "w-full bg-edge-foreground font-semibold text-edge sm:w-auto",
                    "hover:bg-edge-foreground/90 hover:text-edge",
                    "dark:hover:bg-edge-foreground/90 dark:hover:text-edge",
                    "focus-visible:border-edge-foreground/40 focus-visible:ring-edge-foreground/50"
                  )}
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
            </div>
            {failed ? (
              <p className="mt-2 text-xs text-edge-foreground/85" role="alert">
                Could not load your referral code.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ScrollFadeEdges
        className="min-h-0 min-w-0 flex-1"
        fadeClassName="from-page dark:from-card"
        scrollClassName="app-scroll-nested px-6 py-5"
      >
        <dl className="grid grid-cols-2">
          {SIDES.map((side, index) => (
            <div
              key={side.who}
              className={cn(
                "min-w-0",
                index > 0
                  ? "border-l border-dashed border-edge/60 pl-4"
                  : "pr-4"
              )}
            >
              <dt className={captionHeading}>{side.who}</dt>
              <dd className="mt-1 min-w-0">
                <p className="text-2xl font-bold leading-none tabular-nums tracking-tight text-edge">
                  {side.figure}
                </p>
                <p className={cn(sectionDescription, "mt-1.5")}>{side.detail}</p>
              </dd>
            </div>
          ))}
        </dl>
      </ScrollFadeEdges>

      <DialogFooter className="mx-0 mb-0 shrink-0 px-6 sm:justify-start">
        <Button variant="ghost" size="lg" onClick={onNotNow}>
          Not now
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Homepage prompt for the referral loop. Only after a live Core/Edge
 * subscription and a first profitable settled bet or casino offer.
 * Overlay / close snoozes this visit. Not now and a successful copy dismiss it.
 */
export function ReferAFriendDialog({
  suppressed = false,
}: {
  suppressed?: boolean;
}) {
  const pathname = usePathname();
  const { active: publicDemo } = usePublicDemo();
  const { state } = useAppState();
  const { isLoaded, isSignedIn, user } = useUser();
  const [open, setOpen] = useState(false);
  const userId = user?.id ?? null;
  const hidden =
    typeof window === "undefined" || isReferralPromptHidden(userId);
  const subscribed = isReferralSubscriber(state?.settings.billing);
  const hasSuccessMoment =
    state != null &&
    hasReferralSuccessMoment({
      bets: state.bets,
      casinoSettlements: state.casinoSettlements,
    });

  const eligible =
    isLoaded === true &&
    shouldOpenReferralPrompt({
      pathname,
      signedIn: isSignedIn === true,
      publicDemo,
      suppressed,
      hidden,
      subscribed,
      hasSuccessMoment,
    });

  if (eligible !== open) {
    setOpen(eligible);
  }

  function persistDismiss() {
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
        snoozeReferralPrompt(userId);
        setOpen(false);
      }}
    >
      <DialogContent
        className="flex max-h-[min(36rem,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        mobile="center"
        showCloseButton={false}
      >
        <ReferAFriendDialogBody onNotNow={notNow} onCopied={persistDismiss} />
      </DialogContent>
    </Dialog>
  );
}
