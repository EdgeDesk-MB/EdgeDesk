"use client";

/**
 * Lock-in advisor (J3) - close an open back+lay single for a guaranteed
 * P&L at today's user-entered exchange prices. Self-contained trigger +
 * dialog, mirroring ManualSettleDialog. The partial slider lets Sam lock
 * some of the position and let the rest ride; "Log this trade" writes the
 * closing trade as a real bet linked to the same event and offer.
 *
 * 2UP early-payout bets are excluded (canLockIn) - their extra payout
 * branch needs the 2UP desk's own machinery, and generic equalisation
 * would advise the wrong stake.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { MoneyFlow } from "@/components/money-flow";
import { api } from "@/hooks/use-app-state";
import { lockInAdvice, lockInOutcome, type LockInInput } from "@/lib/calc/lock-in";
import { roundPence } from "@/lib/calc/money";
import type { BetMode } from "@/lib/calc";
import type { BetRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const LOCKABLE_TYPES = new Set<string>(["qualifying", "free_snr", "free_sr", "risk_free"]);

/** Open back+lay singles only - no dutch, each-way/extra-place or 2UP (v1). */
export function canLockIn(bet: BetRow): boolean {
  return (
    bet.status === "open" &&
    !bet.legs &&
    !bet.earlyPayout &&
    LOCKABLE_TYPES.has(bet.betType) &&
    bet.backStake > 0 &&
    bet.backOdds > 1 &&
    bet.market !== "each_way" &&
    bet.market !== "extra_place"
  );
}

export function LockInDialog({ bet, onLogged }: { bet: BetRow; onLogged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-[10px] max-sm:h-9 max-sm:px-3 max-sm:text-xs"
        >
          <Lock className="size-3" aria-hidden /> Lock in
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {open ? (
          <LockInDialogContent
            bet={bet}
            onDone={() => {
              setOpen(false);
              onLogged();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function gbpOdds(v: number): string {
  return v.toFixed(2);
}

function LockInDialogContent({ bet, onDone }: { bet: BetRow; onDone: () => void }) {
  const prefillOdds = bet.layOdds > 1 ? bet.layOdds : bet.backOdds;
  const [currentLayOdds, setCurrentLayOdds] = useState(prefillOdds);
  const [currentBackOdds, setCurrentBackOdds] = useState(prefillOdds);
  /** null = full lock; otherwise the slider's chosen stake */
  const [stakeOverride, setStakeOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const input = useMemo<LockInInput | null>(() => {
    if (!(currentLayOdds > 1) || !(currentBackOdds > 1)) return null;
    return {
      mode: bet.betType as BetMode,
      backStake: bet.backStake,
      backOdds: bet.backOdds,
      layStake: bet.layStake,
      layOdds: bet.layOdds,
      commission: bet.commission,
      currentLayOdds,
      currentBackOdds,
      refundAmount: bet.refundAmount ?? undefined,
      refundRetention: bet.refundRetention ?? undefined,
    };
  }, [bet, currentLayOdds, currentBackOdds]);

  const advice = useMemo(() => (input ? lockInAdvice(input) : null), [input]);
  const chosenStake =
    advice == null
      ? 0
      : stakeOverride == null
        ? advice.executableStake
        : Math.min(roundPence(stakeOverride), advice.executableStake);
  const outcome = useMemo(
    () => (input && advice ? lockInOutcome(input, advice.direction, chosenStake) : null),
    [input, advice, chosenStake]
  );
  const fullLock = advice != null && chosenStake >= advice.executableStake - 0.005;
  const tradeOdds = advice?.direction === "back" ? currentBackOdds : currentLayOdds;

  async function logTrade() {
    if (!advice || !outcome || advice.direction === "none" || !(chosenStake > 0)) return;
    setSaving(true);
    try {
      const common = {
        eventId: bet.eventId ?? undefined,
        offerId: bet.offerId ?? undefined,
        market: bet.market,
        selection: bet.selection,
        commission: bet.commission,
        exchangeId: bet.exchangeId ?? undefined,
        notes: `Lock-in close of "${bet.label}"`,
      };
      if (advice.direction === "lay") {
        await api("/api/bets", {
          method: "POST",
          json: {
            ...common,
            label: `Lock-in lay · ${bet.label}`,
            betType: "lay_only",
            layStake: chosenStake,
            layOdds: currentLayOdds,
          },
        });
      } else {
        // An exchange back: commission comes off its winnings, so store
        // commission-adjusted odds - settlement of a plain back is then exact.
        const adjustedOdds = 1 + (currentBackOdds - 1) * (1 - bet.commission);
        await api("/api/bets", {
          method: "POST",
          json: {
            ...common,
            label: `Lock-in back · ${bet.label}`,
            betType: "qualifying",
            backStake: chosenStake,
            backOdds: Number(adjustedOdds.toFixed(4)),
            commission: 0,
          },
        });
      }
      toast.success("Lock-in trade logged", {
        description:
          advice.direction === "lay"
            ? `Lay £${chosenStake.toFixed(2)} @ ${gbpOdds(currentLayOdds)}`
            : `Back £${chosenStake.toFixed(2)} @ ${gbpOdds(currentBackOdds)}`,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Lock in · {bet.label}</DialogTitle>
        <DialogDescription>
          Back £{bet.backStake.toFixed(2)} @ {gbpOdds(bet.backOdds)}
          {bet.layStake > 0
            ? ` · laid £${bet.layStake.toFixed(2)} @ ${gbpOdds(bet.layOdds)}`
            : " · no lay yet"}
          . Enter today&apos;s exchange prices to see the closing trade.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Exchange lay (now)"
          value={currentLayOdds}
          onChange={setCurrentLayOdds}
          min={1.01}
          step={0.01}
          placeholder={gbpOdds(prefillOdds)}
        />
        <NumField
          label="Exchange back (now)"
          value={currentBackOdds}
          onChange={setCurrentBackOdds}
          min={1.01}
          step={0.01}
          placeholder={gbpOdds(prefillOdds)}
        />
      </div>

      {advice == null ? (
        <p className="text-sm text-muted-foreground">Enter both current prices.</p>
      ) : advice.direction === "none" ? (
        <p className="rounded-md border bg-selection-subtle/50 px-3 py-2.5 text-sm">
          Already balanced - both outcomes return{" "}
          <MoneyFlow value={advice.preTrade.ifWin} signColor signDisplay className="inline font-semibold" />.
          Nothing to trade.
        </p>
      ) : (
        <>
          <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                The trade
              </span>
              <EvBasisBadge basis="estimated" description="From the prices you entered - place it at these odds or re-check" />
            </div>
            <p className="mt-1 text-sm font-semibold">
              {advice.direction === "lay" ? "Lay" : "Back on the exchange"}{" "}
              <span className="tabular-nums">£{chosenStake.toFixed(2)}</span> @{" "}
              <span className="tabular-nums">{gbpOdds(tradeOdds)}</span>
              {!fullLock ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  (partial - full lock is £{advice.executableStake.toFixed(2)})
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Lock amount - let some ride or close it all
              </span>
              <span className="flex gap-1">
                {[
                  { label: "Half", frac: 0.5 },
                  { label: "Full lock", frac: 1 },
                ].map(({ label, frac }) => (
                  <button
                    key={label}
                    type="button"
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-selection-subtle",
                      ((frac === 1 && fullLock) ||
                        (frac === 0.5 &&
                          !fullLock &&
                          Math.abs(chosenStake - advice.executableStake * 0.5) < 0.01)) &&
                        "border-primary/40 bg-primary/10 text-primary"
                    )}
                    onClick={() =>
                      setStakeOverride(frac === 1 ? null : roundPence(advice.executableStake * frac))
                    }
                  >
                    {label}
                  </button>
                ))}
              </span>
            </div>
            <input
              type="range"
              aria-label="Lock amount"
              min={0}
              max={advice.executableStake}
              step={0.01}
              value={chosenStake}
              onChange={(e) => setStakeOverride(parseFloat(e.target.value))}
              className="accent-primary"
            />
          </div>

          <div className="overflow-hidden rounded-md border text-sm">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-muted-foreground">If the back bet wins</span>
              <MoneyFlow value={outcome?.ifWin ?? 0} signColor signDisplay className="font-semibold" />
            </div>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-muted-foreground">If it loses</span>
              <MoneyFlow value={outcome?.ifLose ?? 0} signColor signDisplay className="font-semibold" />
            </div>
            <div className="flex items-center justify-between bg-muted/60 px-3 py-2">
              <span className="font-semibold">{fullLock ? "Locked either way" : "Guaranteed (worst case)"}</span>
              <MoneyFlow
                value={outcome?.guaranteed ?? 0}
                signColor
                signDisplay
                className="text-base font-extrabold"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Doing nothing: <MoneyFlow value={advice.preTrade.ifWin} signColor signDisplay className="inline" /> if
            it wins · <MoneyFlow value={advice.preTrade.ifLose} signColor signDisplay className="inline" /> if it
            loses.
          </p>

          <Button onClick={() => void logTrade()} disabled={saving || !(chosenStake > 0)}>
            Log this trade
          </Button>
        </>
      )}
    </>
  );
}
