"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Check, XIcon } from "lucide-react";
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
import type { SubscriptionAccount } from "@/lib/billing/subscription-view";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  hasReferralSuccessMoment,
  isReferralPromptHidden,
  isReferralSubscriber,
  markReferralPromptDismissed,
  shouldOpenReferralPrompt,
  snoozeReferralPrompt,
} from "@/lib/referrals/prompt";
import { cn } from "@/lib/utils";

const REWARDS = [
  {
    label: "They get",
    detail: "50% off their first paid month",
  },
  {
    label: "You get",
    detail: "£10 credit when their first payment lands",
  },
] as const;

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
      <div className="bg-topbar text-topbar-foreground">
        <div className="relative">
          <DialogClose
            className={cn(
              "absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-lg",
              "text-topbar-foreground/80 transition-colors",
              "hover:bg-topbar-foreground/10 hover:text-topbar-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-topbar-foreground/50"
            )}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
            <ReferAFriendArt className="h-[7.25rem] w-full max-w-[17.5rem] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300" />
            <DialogTitle className="mt-3 text-center text-topbar-foreground">
              Refer a friend
            </DialogTitle>
            <DialogDescription className="mt-1 text-center text-topbar-foreground/70">
              Share a link. They save, you get £10 credit.
            </DialogDescription>
            <div className="mt-4 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <code
                aria-busy={(!failed && !referral) || undefined}
                aria-label={
                  failed
                    ? "Referral code unavailable"
                    : referral
                      ? `Your referral code, ${referral.code}`
                      : "Loading referral code"
                }
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg bg-topbar-foreground/12 px-3 font-mono text-sm font-bold tracking-widest text-topbar-foreground"
              >
                {failed ? "----" : (referral?.code ?? "…")}
              </code>
              {failed ? (
                <Button
                  variant="outline"
                  className="border-topbar-foreground/30 bg-transparent text-topbar-foreground hover:bg-topbar-foreground/10 hover:text-topbar-foreground"
                  onClick={retry}
                >
                  Try again
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="bg-topbar-foreground text-topbar hover:bg-topbar-foreground/90"
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
              <p className="mt-2 text-xs text-topbar-foreground/70" role="alert">
                Could not load your referral code.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 px-6 py-5">
        <ul className="flex flex-col gap-3">
          {REWARDS.map((row) => (
            <li key={row.label} className="flex min-w-0 items-start gap-3">
              <span
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <p className="min-w-0 text-pretty break-words text-sm leading-snug">
                <span className="font-semibold">{row.label} </span>
                <span className="text-muted-foreground">{row.detail}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <DialogFooter className="mx-0 mb-0 sm:justify-start">
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
  const [account, setAccount] = useState<SubscriptionAccount | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const userId = user?.id ?? null;
  if (accountUserId !== userId) {
    setAccountUserId(userId);
    setAccount(null);
  }
  const hidden =
    typeof window === "undefined" || isReferralPromptHidden(userId);
  const subscribed = isReferralSubscriber(account);
  const hasSuccessMoment =
    state != null &&
    hasReferralSuccessMoment({
      bets: state.bets,
      casinoSettlements: state.casinoSettlements,
    });

  useEffect(() => {
    if (publicDemo || isSignedIn !== true || !userId) return;
    let cancelled = false;
    api<SubscriptionAccount>("/api/billing/account")
      .then((data) => {
        if (!cancelled) setAccount(data);
      })
      .catch(() => {
        if (!cancelled) setAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [publicDemo, isSignedIn, userId]);

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
        className="gap-0 overflow-hidden p-0 sm:max-w-md"
        mobile="center"
        showCloseButton={false}
      >
        <ReferAFriendDialogBody onNotNow={notNow} onCopied={persistDismiss} />
      </DialogContent>
    </Dialog>
  );
}
