"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { useAppState } from "@/hooks/use-app-state";
import { Gift } from "lucide-react";
import { dialogTitleIcon } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import {
  FreeBetsLots,
  useConvertFreeBetLot,
} from "@/components/accounts/free-bet-lots-panel";
import {
  MobileBalancesDialog,
  type BalancesSheetTab,
} from "@/components/accounts/mobile-balances-dialog";

export type { BalancesSheetTab };

type FreeBetsContextValue = {
  openFreeBets: () => void;
  openBalances: (tab?: BalancesSheetTab) => void;
};

const FreeBetsContext = createContext<FreeBetsContextValue | null>(null);

export function useFreeBets() {
  const ctx = useContext(FreeBetsContext);
  if (!ctx) throw new Error("useFreeBets must be used within FreeBetsProvider");
  return ctx;
}

export function FreeBetsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [balancesOpen, setBalancesOpen] = useState(false);
  const [balancesTab, setBalancesTab] = useState<BalancesSheetTab>("balances");
  const openFreeBets = useCallback(() => setOpen(true), []);
  const openBalances = useCallback((tab: BalancesSheetTab = "balances") => {
    setBalancesTab(tab);
    setBalancesOpen(true);
  }, []);
  const value = useMemo(() => ({ openFreeBets, openBalances }), [openFreeBets, openBalances]);

  return (
    <FreeBetsContext.Provider value={value}>
      <Suspense fallback={null}>
        <FreeBetsQueryOpener onOpen={openFreeBets} />
      </Suspense>
      {children}
      <FreeBetsConvertDialog open={open} onOpenChange={setOpen} />
      <MobileBalancesDialog
        open={balancesOpen}
        onOpenChange={setBalancesOpen}
        tab={balancesTab}
        onTabChange={setBalancesTab}
      />
    </FreeBetsContext.Provider>
  );
}

function FreeBetsQueryOpener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get("freeBets") === "1") onOpen();
  }, [searchParams, onOpen]);
  return null;
}

function FreeBetsConvertDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useAppState(open ? 5_000 : 0);
  const convert = useConvertFreeBetLot(() => onOpenChange(false));

  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(36rem,90vh)] flex-col gap-0 overflow-hidden p-0 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md">
        <DialogHeader className="mx-0 mt-0 shrink-0">
          <DialogTitle className="flex items-center gap-2.5">
            <Gift className={cn(dialogTitleIcon, "text-edge")} />
            Convert free bets
          </DialogTitle>
          <DialogDescription
            explainer={
              <DialogExplainer title="Convert free bets">
                Prioritise converting free bets to grow your bank. When a promo
                awards one, it lands here by bookie.
              </DialogExplainer>
            }
          >
            Convert them to grow your bank.
          </DialogDescription>
        </DialogHeader>

        <ScrollFadeEdges
          className="min-h-0 flex-1"
          fadeClassName="from-page dark:from-card"
          scrollClassName="px-[var(--layout-card-x)] py-[var(--layout-card-x)]"
        >
          {open ? <FreeBetsLots freeBetTotal={freeBetTotal} onConvert={convert} /> : null}
        </ScrollFadeEdges>
      </DialogContent>
    </Dialog>
  );
}
