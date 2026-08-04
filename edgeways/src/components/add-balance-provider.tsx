"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AddBalanceDialog } from "@/components/add-balance-dialog";
import { useAppState } from "@/hooks/use-app-state";

type AddBalanceContextValue = {
  openAddBalance: () => void;
};

const AddBalanceContext = createContext<AddBalanceContextValue | null>(null);

export function useAddBalance() {
  const ctx = useContext(AddBalanceContext);
  if (!ctx) {
    throw new Error("useAddBalance must be used within AddBalanceProvider");
  }
  return ctx;
}

export function AddBalanceProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { state, refresh } = useAppState(5000);
  const accounts = state?.balances?.accounts ?? [];

  const openAddBalance = useCallback(() => setOpen(true), []);

  return (
    <AddBalanceContext.Provider value={{ openAddBalance }}>
      {children}
      <AddBalanceDialog
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        onSaved={refresh}
      />
    </AddBalanceContext.Provider>
  );
}
