"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

/**
 * Open free-bet lots across bookies - convert from Accounts / Home.
 */
export function FreeBetDistributionCard({ className }: { className?: string }) {
  const { state } = useAppState(15_000);
  const { openAddBet } = useAddBet();
  const [lots, setLots] = useState<Lot[]>([]);
  const freeBetTotal = state?.balances?.accounts
    ?.filter((a) => a.type === "bookie")
    .reduce((s, a) => s + (a.freeBets ?? 0), 0);

  useEffect(() => {
    api<{ lots: Lot[] }>("/api/accounts/free-bets")
      .then((r) => setLots(r.lots ?? []))
      .catch(() => setLots([]));
  }, [freeBetTotal]);

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
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {lot.note?.replace(/^Free bet promo - /, "").slice(0, 56) || "Free bet credit"}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 text-[11px]"
              onClick={() => {
                openAddBet({
                  betType: "free_snr",
                  bookmaker: lot.accountName,
                  backStake: lot.remaining,
                  labelSuggestion: `Convert FB · ${lot.accountName}`,
                });
                toast.message("Add bet opened", {
                  description: `£${lot.remaining.toFixed(2)} free bet at ${lot.accountName}`,
                });
              }}
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
