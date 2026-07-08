"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AddBetDialog, type AddBetPrefill } from "@/components/add-bet-dialog";
import { useAppState } from "@/hooks/use-app-state";

type AddBetContextValue = {
  openAddBet: (prefill?: AddBetPrefill) => void;
};

const AddBetContext = createContext<AddBetContextValue | null>(null);

export function useAddBet() {
  const ctx = useContext(AddBetContext);
  if (!ctx) {
    throw new Error("useAddBet must be used within AddBetProvider");
  }
  return ctx;
}

export function AddBetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<AddBetPrefill | undefined>();
  const { state, refresh } = useAppState(5000);
  const events = state?.events ?? [];

  const openAddBet = useCallback((next?: AddBetPrefill) => {
    setPrefill(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  return (
    <AddBetContext.Provider value={{ openAddBet }}>
      {children}
      <AddBetDialog
        open={open}
        onOpenChange={handleOpenChange}
        events={events}
        prefill={prefill}
        onSaved={() => refresh()}
      />
    </AddBetContext.Provider>
  );
}
