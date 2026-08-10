"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useAddBet } from "@/components/add-bet-provider";
import { useAccaRun } from "@/components/acca-run-provider";
import { useBetBuilderRun } from "@/components/bet-builder-run-provider";
import { ScopePlaceChooserDialog } from "@/components/offers/scope-place-chooser";
import {
  resolvePlacementOption,
  type PlacementOption,
} from "@/lib/offers/offer-track-bet";

type ScopePlaceChooserContextValue = {
  openScopeChooser: (options: PlacementOption[]) => void;
};

const ScopePlaceChooserContext = createContext<ScopePlaceChooserContextValue | null>(
  null
);

export function useScopePlaceChooser() {
  const ctx = useContext(ScopePlaceChooserContext);
  if (!ctx) {
    throw new Error("useScopePlaceChooser must be used within ScopePlaceChooserProvider");
  }
  return ctx;
}

export function ScopePlaceChooserProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PlacementOption[]>([]);
  const { openAddBet } = useAddBet();
  const { openAccaRun } = useAccaRun();
  const { openBetBuilderRun } = useBetBuilderRun();

  const openScopeChooser = useCallback((next: PlacementOption[]) => {
    setOptions(next);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setOptions([]);
  }, []);

  const handleSelect = useCallback(
    (option: PlacementOption) => {
      resolvePlacementOption(option, { openAddBet, openAccaRun, openBetBuilderRun });
    },
    [openAddBet, openAccaRun, openBetBuilderRun]
  );

  return (
    <ScopePlaceChooserContext.Provider value={{ openScopeChooser }}>
      {children}
      <ScopePlaceChooserDialog
        open={open}
        onOpenChange={handleOpenChange}
        options={options}
        onSelect={handleSelect}
      />
    </ScopePlaceChooserContext.Provider>
  );
}
