"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { useAddBet } from "@/components/add-bet-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import { Gift } from "lucide-react";

type Lot = {
  id: number;
  accountId: number;
  accountName: string;
  remaining: number;
  originalAmount: number;
  note: string | null;
  createdAt: number;
};

type FreeBetsContextValue = {
  openFreeBets: () => void;
};

const FreeBetsContext = createContext<FreeBetsContextValue | null>(null);

export function useFreeBets() {
  const ctx = useContext(FreeBetsContext);
  if (!ctx) throw new Error("useFreeBets must be used within FreeBetsProvider");
  return ctx;
}

export function FreeBetsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openFreeBets = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openFreeBets }), [openFreeBets]);

  return (
    <FreeBetsContext.Provider value={value}>
      {children}
      <FreeBetsConvertDialog open={open} onOpenChange={setOpen} />
    </FreeBetsContext.Provider>
  );
}

function FreeBetsConvertDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useAppState(open ? 5_000 : 0);
  const { openAddBet } = useAddBet();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);

  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api<{ lots: Lot[] }>("/api/accounts/free-bets")
      .then((r) => setLots(r.lots ?? []))
      .catch(() => setLots([]))
      .finally(() => setLoading(false));
  }, [open, freeBetTotal]);

  function convert(lot: Lot) {
    openAddBet({
      betType: "free_snr",
      bookmaker: lot.accountName,
      backStake: lot.remaining,
      labelSuggestion: `Convert FB · ${lot.accountName}`,
    });
    onOpenChange(false);
    toast.message("Add bet opened", {
      description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-4 text-violet-600" />
            Free bets to convert
          </DialogTitle>
          <DialogDescription>
            Open free-bet balance by bookie - Convert prefills Add bet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {loading && lots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : lots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No open free bets right now.
            </p>
          ) : (
            lots.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <VenueBadge name={lot.accountName} />
                    <MoneyFlow
                      value={lot.remaining}
                      className="font-semibold text-violet-700 dark:text-violet-300"
                    />
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {lot.note?.replace(/^Free bet promo - /, "").slice(0, 64) ||
                      "Free bet credit"}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => convert(lot)}
                >
                  Convert
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
