"use client";

import { useState } from "react";
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
import { moneyPositiveClass } from "@/components/money-flow";
import { resultActionButtonClass } from "@/components/racing/racing-placings-dialog";
import type { BetRow } from "@/lib/db/schema";
import {
  settleFromOutcome,
  settlePartialOutcome,
  type SettledBetStatus,
} from "@/lib/calc";
import { cn } from "@/lib/utils";

function profitEntryClass(value: number): string {
  const rounded = Number((Number.isFinite(value) ? value : 0).toFixed(2));
  if (rounded === 0) return "text-muted-foreground";
  if (rounded > 0) return moneyPositiveClass;
  return "text-negative";
}

/** Variant for Won / Lost settle selectors (pressable 3D success / danger faces). */
export function settleOutcomeButtonVariant(
  kind: "won" | "lost",
  active: boolean
): "success" | "destructive" | "outline" {
  if (!active) return "outline";
  return kind === "won" ? "success" : "destructive";
}

/**
 * Profit Tracker "Set result" dialog. Used from the Tracker row and Boosts
 * Placed cards (controlled open, no trigger).
 */
export function ManualSettleDialog({
  bet,
  onSettle,
  open: openControlled,
  onOpenChange: onOpenChangeControlled,
  showTrigger = true,
}: {
  bet: BetRow;
  onSettle: (status: SettledBetStatus, profit: number) => void;
  /** Controlled open (e.g. Boosts card click). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When false, only the dialog content is used (no "Set result" button). */
  showTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = openControlled !== undefined;
  const open = controlled ? openControlled : uncontrolledOpen;
  const setOpen = onOpenChangeControlled ?? setUncontrolledOpen;

  const [profit, setProfit] = useState(0);
  const [fullResult, setFullResult] = useState<"won" | "lost" | null>(null);

  const settleable = {
    market: bet.market as "other",
    selection: bet.selection,
    betType: (bet.betType as "qualifying") ?? "qualifying",
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    refundAmount: bet.refundAmount ?? undefined,
    refundRetention: bet.refundRetention ?? undefined,
  };

  const knownWinProfit = Number(settleFromOutcome(settleable, true).profit.toFixed(2));
  const knownLoseProfit = Number(settleFromOutcome(settleable, false).profit.toFixed(2));

  function resetDialog() {
    setProfit(0);
    setFullResult(null);
  }

  function selectFull(kind: "won" | "lost") {
    setFullResult(kind);
    setProfit(kind === "won" ? knownWinProfit : knownLoseProfit);
  }

  function settleFull() {
    if (!fullResult) return;
    onSettle(fullResult, Number((Number.isFinite(profit) ? profit : 0).toFixed(2)));
    setOpen(false);
    resetDialog();
  }

  function applyPartial(kind: "half_win" | "half_lose" | "push" | "void") {
    const outcome = settlePartialOutcome(settleable, kind);
    onSettle(outcome.status, Number(outcome.profit.toFixed(2)));
    setOpen(false);
    resetDialog();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetDialog();
      }}
    >
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2 text-[11px] max-sm:h-9 max-sm:px-3 max-sm:text-xs",
              resultActionButtonClass
            )}
          >
            Set result
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set result</DialogTitle>
          <DialogDescription>
            Pick won or lost to fill expected P&amp;L, then settle. Half, push and void calculate for
            you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={settleOutcomeButtonVariant("won", fullResult === "won")}
            onClick={() => selectFull("won")}
          >
            Won
          </Button>
          <Button
            variant={settleOutcomeButtonVariant("lost", fullResult === "lost")}
            onClick={() => selectFull("lost")}
          >
            Lost
          </Button>
        </div>
        <NumField
          label="Net profit (for won / lost)"
          prefix="£"
          value={profit}
          onChange={setProfit}
          prefixClassName="text-base"
          inputClassName={cn(
            "h-11 pl-8 text-lg font-semibold md:text-lg",
            profitEntryClass(profit)
          )}
        />
        <Button className="w-full" disabled={!fullResult} onClick={settleFull}>
          Settle
        </Button>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => applyPartial("void")}
          >
            Void
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPartial("half_win")}>
            ½ win
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPartial("half_lose")}>
            ½ lose
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPartial("push")}>
            Push
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
