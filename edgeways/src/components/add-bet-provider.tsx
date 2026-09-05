"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AddBetDialog, type AddBetPrefill } from "@/components/add-bet-dialog";
import { BOOSTS_CHANGED_EVENT } from "@/components/boosts/boost-checker-form";
import { useEachWayCalculator } from "@/components/each-way-calculator-provider";
import { useAppState } from "@/hooks/use-app-state";
import { useDevStickyOpen } from "@/lib/dev/use-dev-sticky-open";
import type { AppState } from "@/lib/services/state.types";

type AddBetContextValue = {
  openAddBet: (prefill?: AddBetPrefill) => void;
};

const AddBetContext = createContext<AddBetContextValue | null>(null);

const EMPTY_EVENTS: AppState["events"] = [];

export function useAddBet() {
  const ctx = useContext(AddBetContext);
  if (!ctx) {
    throw new Error("useAddBet must be used within AddBetProvider");
  }
  return ctx;
}

export function AddBetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDevStickyOpen("add-bet");
  const [prefill, setPrefill] = useState<AddBetPrefill | undefined>();
  const { state, refresh } = useAppState(5000);
  // Freeze the event list at open so background polls cannot re-render the modal.
  const [eventsSnapshot, setEventsSnapshot] = useState(EMPTY_EVENTS);
  const { openEachWayCalculator } = useEachWayCalculator();

  const openAddBet = useCallback(
    (next?: AddBetPrefill) => {
      setPrefill(next);
      setEventsSnapshot(state?.events ?? EMPTY_EVENTS);
      setOpen(true);
    },
    [state?.events]
  );

  // HMR / sticky-open remounts the provider with an empty snapshot and never
  // re-runs openAddBet. Fill once from state, or leave empty so the dialog
  // fetches /api/events itself.
  if (open && eventsSnapshot.length === 0 && (state?.events?.length ?? 0) > 0) {
    setEventsSnapshot(state!.events);
  }

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  const handleSaved = useCallback(() => {
    const diaryId = prefill?.boostDiaryId;
    refresh();
    if (diaryId != null) {
      window.dispatchEvent(new Event(BOOSTS_CHANGED_EVENT));
    }
  }, [prefill?.boostDiaryId, refresh]);

  const handleOpenEachWay = useCallback(
    (hint?: Parameters<typeof openEachWayCalculator>[0]) => {
      setOpen(false);
      setPrefill(undefined);
      openEachWayCalculator(hint);
    },
    [openEachWayCalculator]
  );

  return (
    <AddBetContext.Provider value={{ openAddBet }}>
      {children}
      {open ? (
        <AddBetDialog
          open={open}
          onOpenChange={handleOpenChange}
          events={eventsSnapshot.length > 0 ? eventsSnapshot : undefined}
          prefill={prefill}
          onSaved={handleSaved}
          onOpenEachWayCalculator={handleOpenEachWay}
        />
      ) : null}
    </AddBetContext.Provider>
  );
}
