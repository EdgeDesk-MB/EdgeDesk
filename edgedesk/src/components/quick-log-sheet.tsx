"use client";

/**
 * Quick-log (C3) - the killer mobile flow. A floating "+" on every mobile
 * screen opens a bottom sheet with three capture paths:
 *   1. Paste slip (B4 parser prefills everything),
 *   2. From plan (today's Daily Plan slots, one tap to log as placed),
 *   3. Minimal manual (bookie, stake, odds - the rest defaults).
 * Mobile captures, desktop curates: bets carry a quick-logged flag for later
 * review in the tracker.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, ListTodo, PencilLine, Plus } from "lucide-react";
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
import { useAddBet } from "@/components/add-bet-provider";
import { api } from "@/hooks/use-app-state";
import { useDoNextItems } from "@/hooks/use-do-next-items";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { buildDailyPlan, type DailyPlanSlot } from "@/lib/plan/daily-plan";
import { formatClockTime } from "@/lib/time-format";
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
      className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-selection-subtle active:bg-selection-subtle"
    >
      <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
        {slot.at != null ? formatClockTime(new Date(slot.at)) : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{slot.title}</span>
        {slot.detail ? (
          <span className="block truncate text-xs text-muted-foreground">{slot.detail}</span>
        ) : null}
      </span>
    </button>
  );
}

export function QuickLogSheet() {
  const isMobile = useIsMobile();
  const { openAddBet } = useAddBet();
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
    }).filter((s) => !s.done && s.doKind != null);
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
        aria-label="Quick log a bet"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
      >
        <Plus className="size-7" aria-hidden />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick log</DialogTitle>
            <DialogDescription>
              Capture the bet now, tidy the details on desktop later.
            </DialogDescription>
          </DialogHeader>

          {path === "menu" ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 justify-start gap-3 text-sm"
                onClick={() => {
                  setOpen(false);
                  openAddBet({ quickLogged: true, autoOpenImport: true });
                }}
              >
                <ClipboardPaste className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
                Paste slip
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-12 justify-start gap-3 text-sm"
                onClick={() => setPath("manual")}
              >
                <PencilLine className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
                Log manually
              </Button>

              {planSlots.length > 0 ? (
                <div className="mt-1.5">
                  <p className="flex items-center gap-1.5 px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <ListTodo className="size-3.5" aria-hidden />
                    From today&apos;s plan
                  </p>
                  <div className="app-scroll-nested max-h-56 overflow-y-auto">
                    {planSlots.map((slot) => (
                      <PlanSlotButton key={slot.id} slot={slot} onPick={pickSlot} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="quick-log-bookie">Bookie</Label>
                <Input
                  id="quick-log-bookie"
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
                <Button
                  type="button"
                  className={cn("h-11 flex-1")}
                  onClick={saveManual}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
