"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { BetBuilderRunCreateDialog } from "@/components/bet-builder/create-run-dialog";
import type { BetBuilderRunPrefill } from "@/lib/bet-builder/bet-builder-run-prefill";
import { useAppState } from "@/hooks/use-app-state";

type BetBuilderRunContextValue = {
  openBetBuilderRun: (prefill?: BetBuilderRunPrefill) => void;
};

const BetBuilderRunContext = createContext<BetBuilderRunContextValue | null>(null);

export function useBetBuilderRun() {
  const ctx = useContext(BetBuilderRunContext);
  if (!ctx) {
    throw new Error("useBetBuilderRun must be used within BetBuilderRunProvider");
  }
  return ctx;
}

export function BetBuilderRunProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<BetBuilderRunPrefill | undefined>();
  const { refresh } = useAppState(5000);

  const openBetBuilderRun = useCallback((next?: BetBuilderRunPrefill) => {
    setPrefill(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  return (
    <BetBuilderRunContext.Provider value={{ openBetBuilderRun }}>
      {children}
      <BetBuilderRunCreateDialog
        open={open}
        onOpenChange={handleOpenChange}
        prefill={prefill}
        onCreated={() => refresh()}
      />
    </BetBuilderRunContext.Provider>
  );
}
