"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MatchedCalculator } from "@/components/calc/matched-calculator";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import type { BetMode, PartLay } from "@/lib/calc";

export type MatchedCalculatorPrefill = {
  mode?: BetMode;
  bookmaker?: string;
  backStake?: number;
  backOdds?: number;
  layOdds?: number;
  exchangeId?: number;
  commission?: number;
  advanced?: boolean;
  partLays?: PartLay[];
  layStakeOverride?: number;
  refundAmount?: number;
  refundRetention?: number;
};

type MatchedCalculatorContextValue = {
  openMatchedCalculator: (prefill?: MatchedCalculatorPrefill) => void;
};

const MatchedCalculatorContext = createContext<MatchedCalculatorContextValue | null>(null);

export function useMatchedCalculator() {
  const ctx = useContext(MatchedCalculatorContext);
  if (!ctx) {
    throw new Error("useMatchedCalculator must be used within MatchedCalculatorProvider");
  }
  return ctx;
}

export function MatchedCalculatorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<MatchedCalculatorPrefill | undefined>();

  const openMatchedCalculator = useCallback((next?: MatchedCalculatorPrefill) => {
    setPrefill(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  return (
    <MatchedCalculatorContext.Provider value={{ openMatchedCalculator }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]"
          onFocusOutside={preventDialogDismissOnPortaledContent}
          onPointerDownOutside={preventDialogDismissOnPortaledContent}
          onInteractOutside={preventDialogDismissOnPortaledContent}
        >
          <DialogHeader className="mx-0 mt-0">
            <DialogTitle>Matched calculator</DialogTitle>
            <DialogDescription>
              Work out the lay stake and locked-in profit.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto p-6">
            <MatchedCalculator prefill={prefill} open={open} />
          </div>
        </DialogContent>
      </Dialog>
    </MatchedCalculatorContext.Provider>
  );
}
