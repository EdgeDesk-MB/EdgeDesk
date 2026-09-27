"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { ReferAFriendArt } from "@/components/referrals/refer-a-friend-art";
import { useReferralShare } from "@/components/referrals/referral-share-panel";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { api, useAppState } from "@/hooks/use-app-state";
import { formatGbp } from "@/lib/format-money";
import {
  hasRecentReferralSettleAction,
  isReferralPromptDismissed,
  isReferralSubscriber,
  markReferralPromptDismissed,
  shouldArmReferralAsk,
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

/** Lets the settle dialog finish its exit before this one opens. */
const OPEN_DELAY_MS = 400;

function ReferAFriendDialogBody({
  banked,
  onNotNow,
  onCopied,
}: {
  banked: string;
  onNotNow: () => void;
  onCopied: () => void;
}) {
  const { referral, failed, retry, copyLink } = useReferralShare("home-prompt");

  return (
    <>
      <div className="shrink-0 bg-edge text-edge-foreground">
        <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
          <ReferAFriendArt
            amount={banked}
            className="h-[6.5rem] w-full max-w-[15rem]"
          />
          <DialogTitle className="mt-3 text-center text-edge-foreground">
            You&apos;re in the money!
          </DialogTitle>
          <DialogDescription className="mt-1 text-pretty text-center text-edge-foreground/85">
            You&apos;ve just banked{" "}
            <span className="font-semibold tabular-nums text-edge-foreground">
              {banked}
            </span>
            . Share Edgeways and you both save.
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
                {referral ? "Copy my link" : "Loading your link"}
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

      <DialogFooter className="mx-0 mb-0 shrink-0 px-6">
        <Button
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
          onClick={onNotNow}
        >
          Not now
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Refer a friend ask (EDGE-219). Arms when a settle made in this tab takes
 * realised P&L above £0 for the first time, on a live Core/Edge plan, then
 * opens once no other dialog is up. Opening records the ask on the desk, so
 * any close is final. Settings keeps the link for later.
 */
export function ReferAFriendDialog({
  suppressed = false,
}: {
  suppressed?: boolean;
}) {
  const { active: publicDemo } = usePublicDemo();
  const { state, pollingPaused, applyLocalSettingsPatch } = useAppState();
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id ?? null;
  const settledProfit = state?.settledProfit ?? null;
  const [seenProfit, setSeenProfit] = useState<number | null>(null);
  const [banked, setBanked] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [asked, setAsked] = useState(false);

  if (settledProfit != null && settledProfit !== seenProfit) {
    setSeenProfit(settledProfit);
    if (
      banked == null &&
      !asked &&
      isLoaded === true &&
      shouldArmReferralAsk({
        before: seenProfit,
        after: settledProfit,
        recentSettle: hasRecentReferralSettleAction(),
        signedIn: isSignedIn === true,
        publicDemo,
        subscribed: isReferralSubscriber(state?.settings.billing),
        alreadyAsked:
          state?.settings.referralAskShownAt != null ||
          isReferralPromptDismissed(userId),
      })
    ) {
      setBanked(settledProfit);
    }
  }

  const readyToOpen =
    banked != null && !asked && !open && !pollingPaused && !suppressed;

  useEffect(() => {
    if (!readyToOpen) return;
    const timer = window.setTimeout(() => {
      const shownAt = Date.now();
      setOpen(true);
      setAsked(true);
      markReferralPromptDismissed(userId);
      applyLocalSettingsPatch({ referralAskShownAt: shownAt });
      void api("/api/settings", {
        method: "PATCH",
        json: { referralAskShownAt: shownAt },
      }).catch(() => {
        /* the device latch above still holds */
      });
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [readyToOpen, userId, applyLocalSettingsPatch]);

  function close(copied: boolean) {
    setOpen(false);
    setBanked(null);
    if (!copied) toast("You can copy your link later from Settings.");
  }

  if (!open || banked == null) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close(false);
      }}
    >
      <DialogContent
        className="flex max-h-[min(36rem,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        mobile="center"
        showCloseButton={false}
      >
        <ReferAFriendDialogBody
          banked={formatGbp(banked)}
          onNotNow={() => close(false)}
          onCopied={() => close(true)}
        />
      </DialogContent>
    </Dialog>
  );
}
