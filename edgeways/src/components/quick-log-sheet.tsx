"use client";

/**
 * Quick-log (C3) - the killer mobile flow. A floating "+" on every mobile
 * screen opens a bottom sheet with three capture paths:
 *   1. Paste slip (B4 parser prefills everything),
 *   2. From plan (today's Daily Plan slots, one tap to log as placed),
 *   3. Minimal manual (bookie, stake, odds - the rest defaults).
 * Plus a quick-actions grid reaching every global modal (new offer, balance,
 * matched calculator, casino log, track fixture) so common tasks never need
 * a navigation detour on the phone.
 * Mobile captures, desktop curates: bets carry a quick-logged flag for later
 * review in the tracker.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarSearch,
  Calculator,
  ClipboardPaste,
  Dices,
  Zap,
  Gift,
  ListTodo,
  PencilLine,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddBalance } from "@/components/add-balance-provider";
import { useAddBet } from "@/components/add-bet-provider";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { useBoostCheck } from "@/components/boosts/boost-check-provider";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useTrackFixture } from "@/components/track-fixture-provider";
import { api } from "@/hooks/use-app-state";
import { beginEffort } from "@/lib/effort-timer";
import { useDoNextItems } from "@/hooks/use-do-next-items";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { buildDailyPlan, type DailyPlanSlot } from "@/lib/plan/daily-plan";
import {
  listRowInteractive,
  offerCampaignCardInteractive,
  panelSurface,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

type QuickLogPath = "menu" | "manual";

function PlanSlotButton({
  slot,
  onPick,
}: {
  slot: DailyPlanSlot;
  onPick: (slot: DailyPlanSlot) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(slot)}
      className={cn(
        listRowInteractive,
        "flex min-h-12 w-full items-center gap-3 px-2 py-3 text-left outline-none active:bg-selection-subtle",
        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{slot.title}</span>
        {slot.detail ? (
          <span className="block truncate text-xs text-muted-foreground">{slot.detail}</span>
        ) : null}
      </span>
    </button>
  );
}

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
        "skeuo-solid flex min-h-[5.5rem] flex-col items-start justify-center gap-1 rounded-xl bg-primary px-4 py-3.5 text-left text-primary-foreground outline-none",
        "active:brightness-95",
        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
      )}
    >
      <Icon className="size-6" aria-hidden />
      <span className="text-base font-semibold leading-tight">{label}</span>
      <span className="text-xs leading-tight">{caption}</span>
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
        "flex min-h-[5.5rem] flex-col items-start justify-center gap-1 px-4 py-3.5 text-left outline-none",
        "active:bg-selection-subtle",
        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page"
      )}
    >
      <Icon className="size-6 shrink-0 text-primary-text" aria-hidden />
      <span className="text-base font-medium leading-tight">{label}</span>
    </button>
  );
}

export function QuickLogSheet() {
  const isMobile = useIsMobile();
  const { openAddBet } = useAddBet();
  const { openAddBalance } = useAddBalance();
  const { openCasinoLog } = useCasinoLog();
  const { openBoostCheck } = useBoostCheck();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer } = useOfferDialog();
  const { openTrackFixture } = useTrackFixture();
  const { items: doNext, state } = useDoNextItems(5000);
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<QuickLogPath>("menu");
  const [bookie, setBookie] = useState("");
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("");
  const [saving, setSaving] = useState(false);

  const planSlots = useMemo(() => {
    if (!state) return [];
    return buildDailyPlan({
      offers: state.offers ?? [],
      doNext,
      races: [],
      fixtures: [],
      accaLegs: state.accaLayDue ?? [],
    }).filter((s) => !s.done && (s.doKind != null || s.id.startsWith("acca-lay-")));
  }, [state, doNext]);

  if (isMobile !== true) return null;

  const reset = () => {
    setPath("menu");
    setBookie("");
    setStake("");
    setOdds("");
  };

  function pickSlot(slot: DailyPlanSlot) {
    const item = doNext.find((i) => i.id === slot.id);
    if (item?.offerId != null) beginEffort(item.offerId, item.kind);
    setOpen(false);
    openAddBet({
      quickLogged: true,
      bookmaker: item?.bookmaker ?? undefined,
      offerId: item?.offerId ?? undefined,
      labelSuggestion: item?.offerTitle ?? slot.title,
      ...(item?.convertLot
        ? { betType: "free_snr" as const, backStake: item.convertLot.remaining }
        : {}),
    });
  }

  async function saveManual() {
    const stakeN = parseFloat(stake);
    const oddsN = parseFloat(odds);
    if (!bookie.trim() || !Number.isFinite(stakeN) || stakeN <= 0) {
      toast.error("Bookie and stake needed");
      return;
    }
    setSaving(true);
    try {
      await api("/api/bets", {
        method: "POST",
        json: {
          label: `Quick log · ${bookie.trim()}`,
          market: "other",
          bookmaker: bookie.trim(),
          backStake: stakeN,
          backOdds: Number.isFinite(oddsN) && oddsN > 1 ? oddsN : 0,
          quickLogged: true,
        },
      });
      toast.success("Quick-logged", {
        description: "Flagged for review in the Profit Tracker.",
      });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error("Could not save", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open quick actions"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="skeuo-solid fixed right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
      >
        <Zap className="size-7" aria-hidden />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent data-dialog-tone="page" className="dark:bg-page">
          <DialogHeader>
            <DialogTitle>{path === "manual" ? "Log manually" : "Quick actions"}</DialogTitle>
            <DialogDescription>
              {path === "manual"
                ? "Capture the stake and odds, tidy the rest later."
                : "Log now, tidy the details later."}
            </DialogDescription>
          </DialogHeader>

          {path === "menu" ? (
            // min-w-0: DialogContent is a grid, so without it this column sizes
            // to the widest plan row's min-content and overflows the sheet.
            <div className="flex min-w-0 flex-col gap-2">
              {planSlots.length > 0 ? (
                <div className="mb-1.5">
                  <p className="flex items-center gap-1.5 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ListTodo className="size-3.5" aria-hidden />
                    From today&apos;s plan
                  </p>
                  <div className="app-scroll-nested max-h-44 overflow-y-auto">
                    {planSlots.map((slot) => (
                      <PlanSlotButton key={slot.id} slot={slot} onPick={pickSlot} />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5">
                <CapturePathButton
                  icon={ClipboardPaste}
                  label="Paste slip"
                  caption="Screenshot in, bet logged"
                  onPick={() => {
                    setOpen(false);
                    openAddBet({ quickLogged: true, autoOpenImport: true });
                  }}
                />
                <CapturePathButton
                  icon={PencilLine}
                  label="Log manually"
                  caption="Bookie, stake, odds"
                  onPick={() => setPath("manual")}
                />
              </div>

              <div className="mt-1.5">
                <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick actions
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <QuickActionButton
                    icon={Gift}
                    label="New offer"
                    onPick={() => {
                      setOpen(false);
                      openOffer();
                    }}
                  />
                  <QuickActionButton
                    icon={Wallet}
                    label="Add balance"
                    onPick={() => {
                      setOpen(false);
                      openAddBalance();
                    }}
                  />
                  <QuickActionButton
                    icon={Calculator}
                    label="Matched calc"
                    onPick={() => {
                      setOpen(false);
                      openMatchedCalculator();
                    }}
                  />
                  <QuickActionButton
                    icon={Dices}
                    label="Casino offer"
                    onPick={() => {
                      setOpen(false);
                      openCasinoLog();
                    }}
                  />
                  <QuickActionButton
                    icon={Zap}
                    label="Boost check"
                    onPick={() => {
                      setOpen(false);
                      openBoostCheck();
                    }}
                  />
                  <QuickActionButton
                    icon={CalendarSearch}
                    label="Track fixture"
                    onPick={() => {
                      setOpen(false);
                      openTrackFixture();
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void saveManual();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quick-log-bookie">Bookie</Label>
                <Input
                  id="quick-log-bookie"
                  className="h-11"
                  value={bookie}
                  onChange={(e) => setBookie(e.target.value)}
                  placeholder="Bet365"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="quick-log-stake">Stake (£)</Label>
                  <Input
                    id="quick-log-stake"
                    className="h-11"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="quick-log-odds">Odds</Label>
                  <Input
                    id="quick-log-odds"
                    className="h-11"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={0.01}
                    value={odds}
                    onChange={(e) => setOdds(e.target.value)}
                    placeholder="2.50"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1"
                  onClick={() => setPath("menu")}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button type="submit" className="h-11 flex-1" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
