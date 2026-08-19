"use client";

/**
 * Global "Check a boost" dialog - openable from the side-nav quick action on
 * any page, mirroring the add-bet / casino-log providers. Logging fires
 * BOOSTS_CHANGED_EVENT so the Boosts page diary refreshes if mounted. The
 * form is a child of DialogContent, so its state unmounts cleanly on close.
 */

import { createContext, useCallback, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BoostCheckerForm } from "@/components/boosts/boost-checker-form";

type BoostCheckContextValue = {
  openBoostCheck: () => void;
};

const BoostCheckContext = createContext<BoostCheckContextValue | null>(null);

export function useBoostCheck() {
  const ctx = useContext(BoostCheckContext);
  if (!ctx) throw new Error("useBoostCheck must be used within BoostCheckProvider");
  return ctx;
}

export function BoostCheckProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openBoostCheck = useCallback(() => setOpen(true), []);

  return (
    <BoostCheckContext.Provider value={{ openBoostCheck }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check a boost</DialogTitle>
            <DialogDescription>
              Enter a boosted price and fair odds.
            </DialogDescription>
          </DialogHeader>
          <BoostCheckerForm onLogged={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </BoostCheckContext.Provider>
  );
}
