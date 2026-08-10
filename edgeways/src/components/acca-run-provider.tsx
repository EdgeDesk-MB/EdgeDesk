"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AccaRunCreateDialog } from "@/components/acca/create-run-dialog";
import type { AccaRunPrefill } from "@/lib/acca/acca-run-prefill";
import { useAppState } from "@/hooks/use-app-state";

type AccaRunContextValue = {
  openAccaRun: (prefill?: AccaRunPrefill) => void;
};

const AccaRunContext = createContext<AccaRunContextValue | null>(null);

export function useAccaRun() {
  const ctx = useContext(AccaRunContext);
  if (!ctx) {
    throw new Error("useAccaRun must be used within AccaRunProvider");
  }
  return ctx;
}

export function AccaRunProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<AccaRunPrefill | undefined>();
  const { refresh } = useAppState(5000);

  const openAccaRun = useCallback((next?: AccaRunPrefill) => {
    setPrefill(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  return (
    <AccaRunContext.Provider value={{ openAccaRun }}>
      {children}
      <AccaRunCreateDialog
        open={open}
        onOpenChange={handleOpenChange}
        prefill={prefill}
        onCreated={() => refresh()}
      />
    </AccaRunContext.Provider>
  );
}
