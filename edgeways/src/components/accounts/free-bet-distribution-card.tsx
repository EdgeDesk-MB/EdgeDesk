"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { useAddBet } from "@/components/add-bet-provider";
import { useAccaRun } from "@/components/acca-run-provider";
import { useBetBuilderRun } from "@/components/bet-builder-run-provider";
import { useScopePlaceChooser } from "@/components/scope-place-chooser-provider";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  deriveFreeBetLotConvertAction,
  resolveTrackBetDestination,
} from "@/lib/offers/offer-track-bet";
import { Gift } from "lucide-react";
import { convertFreeBetButtonClass } from "@/lib/ui/surface-styles";

type Lot = {
  id: number;
  accountId: number;
  accountName: string;
  remaining: number;
  originalAmount: number;
  note: string | null;
  createdAt: number;
  betId: number | null;
};

/**
 * Open free-bet lots across bookies - convert from Accounts / Home.
 */
export function FreeBetDistributionCard({ className }: { className?: string }) {
  const { state } = useAppState(15_000);
  const { openAddBet } = useAddBet();
  const { openAccaRun } = useAccaRun();
  const { openBetBuilderRun } = useBetBuilderRun();
  const { openScopeChooser } = useScopePlaceChooser();
  const [lots, setLots] = useState<Lot[]>([]);
  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

  useEffect(() => {
    api<{ lots: Lot[] }>("/api/accounts/free-bets")
      .then((r) => setLots(r.lots ?? []))
      .catch(() => setLots([]));
  }, [freeBetTotal]);

  function convert(lot: Lot) {
    const offerId =
      lot.betId != null
        ? state?.bets?.find((b) => b.id === lot.betId)?.offerId ?? null
        : null;
    const offer =
      offerId != null ? state?.offers?.find((o) => o.id === offerId) ?? null : null;
    const action = deriveFreeBetLotConvertAction(lot, offer, state?.settings);
    const opened = resolveTrackBetDestination(action, {
      openAddBet,
      openAccaRun,
      openBetBuilderRun,
      openScopeChooser,
    });
    if (!opened) return;
    if (action.destination.kind === "acca_desk") {
      toast.message("Acca Desk opened", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName} · reward Acca`,
      });
    } else if (action.destination.kind === "bet_builder_desk") {
      toast.message("Bet Builder Desk opened", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    } else if (action.destination.kind === "choose") {
      toast.message("Choose how to convert", {
        description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    } else {
      toast.message("Add bet opened", {
        description:
          offer == null
            ? `£${lot.remaining.toFixed(2)} at ${lot.accountName} · no linked campaign`
            : `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
      });
    }
  }

  if (lots.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle section className="flex items-center gap-1.5">
          <Gift className="size-3.5 text-violet-600" />
          Free bets to convert
        </CardTitle>
        <CardDescription>
          Open free-bet balance by bookie - tap Convert to prefill Add bet.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {lots.slice(0, 8).map((lot) => (
          <div
            key={lot.id}
            className="flex items-center justify-between gap-2 rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-2"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <VenueBadge name={lot.accountName} />
                <MoneyFlow
                  value={lot.remaining}
                  className="font-semibold text-violet-700 dark:text-violet-300"
                />
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {lot.note?.replace(/^Free bet promo - /, "").slice(0, 56) || "Free bet credit"}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="edge"
              className={convertFreeBetButtonClass}
              onClick={() => convert(lot)}
            >
              Convert
            </Button>
          </div>
        ))}
        {lots.length > 8 ? (
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link href="/accounts">View all in Accounts →</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
