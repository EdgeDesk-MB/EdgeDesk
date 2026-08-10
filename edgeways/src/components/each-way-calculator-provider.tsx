"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { EachWayCalculatorForm } from "@/components/calc/each-way-calculator-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import { useAppState } from "@/hooks/use-app-state";

export type EachWayCalculatorPrefill = {
  mode?: "each_way" | "extra_place";
  bookmaker?: string;
  selection?: string;
  stakePerPart?: number;
  winOdds?: number;
  layWinOdds?: number;
  /** Exchange PLACE market lay odds (manual until desk has PLACE feed). */
  layPlaceOdds?: number;
  placeFraction?: number;
  fieldSize?: number;
  bookiePlaces?: number;
  exchangePlaces?: number;
  commission?: number;
  exchangeId?: number;
  homeTeam?: string;
  awayTeam?: string;
  eventId?: number;
  raceExternalId?: string;
  raceEventDate?: string;
  labelSuggestion?: string;
  offerId?: number;
};

type EachWayCalculatorContextValue = {
  openEachWayCalculator: (prefill?: EachWayCalculatorPrefill) => void;
};

const EachWayCalculatorContext = createContext<EachWayCalculatorContextValue | null>(null);

export function useEachWayCalculator() {
  const ctx = useContext(EachWayCalculatorContext);
  if (!ctx) {
    throw new Error("useEachWayCalculator must be used within EachWayCalculatorProvider");
  }
  return ctx;
}

export function EachWayCalculatorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<EachWayCalculatorPrefill | undefined>();
  const { refresh } = useAppState(5000);

  const openEachWayCalculator = useCallback((next?: EachWayCalculatorPrefill) => {
    setPrefill(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  return (
    <EachWayCalculatorContext.Provider value={{ openEachWayCalculator }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]"
          onFocusOutside={preventDialogDismissOnPortaledContent}
          onPointerDownOutside={preventDialogDismissOnPortaledContent}
          onInteractOutside={preventDialogDismissOnPortaledContent}
        >
          <DialogHeader className="border-b px-6 pb-4 pt-7">
            <DialogTitle className="text-[25px] font-extrabold tracking-tight">
              Each Way Calculator
            </DialogTitle>
            <DialogDescription>
              Dual win + place lays for each-way and extra-place tickets. Saves to the Profit
              Tracker with race linkage for auto-settle.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto p-6">
            <EachWayCalculatorForm
              prefill={prefill}
              open={open}
              embedded
              onSaved={() => {
                refresh();
                handleOpenChange(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </EachWayCalculatorContext.Provider>
  );
}
