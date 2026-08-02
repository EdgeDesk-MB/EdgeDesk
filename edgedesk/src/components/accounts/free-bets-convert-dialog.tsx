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
import { api, apiGet, useAppState } from "@/hooks/use-app-state";
import { Gift, Trash2 } from "lucide-react";

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

  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

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
      <DialogContent className="max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-4 shrink-0 text-violet-600" />
            Free bets to convert
          </DialogTitle>
          <DialogDescription className="text-pretty">
            Open free-bet balance by bookie. Convert prefills Add bet.
          </DialogDescription>
        </DialogHeader>

        {open ? <FreeBetsLots freeBetTotal={freeBetTotal} onConvert={convert} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lots live in a child mounted per open, refetching as the polled free-bet
 * total moves; loading is the null state, so no synchronous effect setState.
 */
function FreeBetsLots({
  freeBetTotal,
  onConvert,
}: {
  freeBetTotal: number | undefined;
  onConvert: (lot: Lot) => void;
}) {
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    apiGet<{ lots: Lot[] }>("/api/accounts/free-bets")
      .then((r) => {
        if (live) setLots(r.lots ?? []);
      })
      .catch(() => {
        if (live) setLots([]);
      });
    return () => {
      live = false;
    };
  }, [freeBetTotal, reloadKey]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {lots == null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : lots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No open free bets right now.
        </p>
      ) : (
        lots.map((lot) => {
          const note =
            lot.note?.replace(/^Free bet promo - /, "").trim() || "Free bet credit";
          return (
            <div
              key={lot.id}
              className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="flex flex-wrap items-center gap-1.5">
                  <VenueBadge name={lot.accountName} />
                  <MoneyFlow
                    value={lot.remaining}
                    className="font-semibold text-violet-700 dark:text-violet-300"
                  />
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug break-words text-muted-foreground">
                  {note}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => onConvert(lot)}
                >
                  Convert
                </Button>
                <RemoveFreeBetButton
                  lot={lot}
                  onRemoved={() => setReloadKey((k) => k + 1)}
                />
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function RemoveFreeBetButton({
  lot,
  onRemoved,
}: {
  lot: Lot;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/api/accounts/free-bets", {
        method: "DELETE",
        json: { lotId: lot.id },
      });
      setOpen(false);
      toast.success("Free bet removed");
      onRemoved();
    } catch (e) {
      toast.error("Could not remove free bet", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        aria-label={`Remove free bet for ${lot.accountName}`}
        title="Remove free bet"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobile="center" className="max-w-sm" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Remove free bet?</DialogTitle>
            <DialogDescription>
              Are you sure you wish to remove the free bet balance for{" "}
              <span className="font-medium text-foreground">{lot.accountName}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Removing…" : "Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
