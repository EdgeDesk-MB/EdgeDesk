"use client";

/**
 * Mobile quick actions. A floating brand bolt on every phone screen opens a
 * bottom sheet that mirrors Cmd+K: Paste slip and Add bet as the capture
 * paths, then the global modals (new offer, balance, calculator, casino,
 * boost, track fixture).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarSearch,
  Calculator,
  ClipboardPaste,
  Dices,
  Zap,
  Gift,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EdgewaysBolt } from "@/components/edgeways-logo-icon";
import { useAddBalance } from "@/components/add-balance-provider";
import { useAddBet } from "@/components/add-bet-provider";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { useBoostCheck } from "@/components/boosts/boost-check-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { useAppState } from "@/hooks/use-app-state";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  captionHeading,
  offerCampaignCardInteractive,
  panelSurface,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * The two capture paths are the sheet's reason to exist, so they wear the
 * FAB's own material (bg-primary + skeuo-solid face) - the one bold spend
 * on this surface.
 */
function CapturePathButton({
  icon: Icon,
  label,
  caption,
  onPick,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        offerCampaignCardInteractive,
        "skeuo-solid flex min-h-[5.5rem] min-w-0 flex-col items-start justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-left text-primary-foreground outline-none",
        "active:brightness-95",
        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
      )}
    >
      <Icon className="size-6 shrink-0" aria-hidden />
      <span className="flex min-w-0 w-full flex-col gap-1">
        <span className="min-w-0 w-full text-pretty break-words text-sm font-semibold leading-tight">
          {label}
        </span>
        <span className="min-w-0 w-full text-pretty break-words text-xs leading-tight">
          {caption}
        </span>
      </span>
    </button>
  );
}

/** Welcome-hub tile language: glassy plate, brand-tinted icon, thumb-sized. */
function QuickActionButton({
  icon: Icon,
  label,
  onPick,
}: {
  icon: LucideIcon;
  label: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        panelSurface,
        offerCampaignCardInteractive,
        "flex min-h-[5.5rem] min-w-0 flex-col items-start justify-center gap-2 px-4 py-3.5 text-left outline-none",
        "active:bg-selection-subtle",
        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
      )}
    >
      <Icon className="size-6 shrink-0 text-primary-text" aria-hidden />
      <span className="min-w-0 w-full text-pretty break-words text-sm font-medium leading-tight">
        {label}
      </span>
    </button>
  );
}

export function QuickLogSheet() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { openAddBet } = useAddBet();
  const { openAddBalance } = useAddBalance();
  const { openCasinoLog } = useCasinoLog();
  const { openBoostCheck } = useBoostCheck();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer } = useOfferDialog();
  const { openTrackFixture } = useTrackFixture();
  const { state } = useAppState();
  const [open, setOpen] = useState(false);

  if (isMobile !== true) return null;

  function launch(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open quick actions"
        onClick={() => setOpen(true)}
        className="skeuo-solid quick-actions-fab fixed right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
      >
        <EdgewaysBolt className="size-12" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-dialog-tone="page" className="dark:bg-page">
          <DialogHeader>
            <DialogTitle>Quick actions</DialogTitle>
            <DialogDescription>Log a bet, or jump to a desk action.</DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-5">
            <div className="grid min-w-0 grid-cols-2 gap-2.5">
              <CapturePathButton
                icon={ClipboardPaste}
                label="Paste slip"
                caption="Screenshot in, bet logged"
                onPick={() => launch(() => openAddBet({ autoOpenImport: true }))}
              />
              <CapturePathButton
                icon={Plus}
                label="Add bet"
                caption="Bookie, event, stake"
                onPick={() => launch(() => openAddBet())}
              />
            </div>

            <div>
              <p className={cn(captionHeading, "px-1 pb-2.5")}>Actions</p>
              <div className="grid min-w-0 grid-cols-2 gap-2.5">
                <QuickActionButton
                  icon={Gift}
                  label="New offer"
                  onPick={() =>
                    launch(() => {
                      if (!canDesk(state?.settings, "offers_pipeline")) {
                        router.push("/offers");
                        return;
                      }
                      openOffer();
                    })
                  }
                />
                <QuickActionButton
                  icon={Wallet}
                  label="Adjust balance"
                  onPick={() => launch(() => openAddBalance())}
                />
                <QuickActionButton
                  icon={Calculator}
                  label="Matched calculator"
                  onPick={() => launch(() => openMatchedCalculator())}
                />
                <QuickActionButton
                  icon={Dices}
                  label="Log casino offer"
                  onPick={() => launch(() => openCasinoLog())}
                />
                <QuickActionButton
                  icon={Zap}
                  label="Check a boost"
                  onPick={() => launch(() => openBoostCheck())}
                />
                <QuickActionButton
                  icon={CalendarSearch}
                  label="Track fixture"
                  onPick={() => launch(() => openTrackFixture())}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
