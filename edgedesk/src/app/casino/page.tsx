"use client";

/**
 * Casino desk (H2) - wagering-offer EV with variance honesty. EV here is an
 * expectation across many attempts, never a lock; every verdict carries a
 * variance tier and the copy never pretends a single session tracks the EV.
 * Casino money stays OUT of the matched P&L surfaces by design.
 * The log dialog itself lives in CasinoLogProvider (side-nav quick action).
 */

import { useCallback, useEffect, useState } from "react";
import { Dices, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CasinoGameLibraryDialog } from "@/components/casino/casino-game-library-dialog";
import { CasinoSimDialog } from "@/components/casino/casino-sim-dialog";
import { useCasinoLog } from "@/components/casino/casino-log-provider";
import { BASIS_COPY, CASINO_CHANGED_EVENT, VarianceChip, gbp } from "@/components/casino/casino-ui";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api } from "@/hooks/use-app-state";
import { houseEdgeFromRtp, varianceTier, DEFAULT_RTP } from "@/lib/calc/casino-ev";
import { formatRtpPct } from "@/lib/casino/game-library";
import type { CasinoOfferRow } from "@/lib/db/schema";

const STATUS_LABEL: Record<CasinoOfferRow["status"], string> = {
  planned: "Planned",
  active: "In progress",
  completed: "Completed",
  expired: "Expired",
};

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={onConfirm}
        onBlur={() => setArmed(false)}
      >
        Delete?
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground"
      aria-label="Delete offer"
      onClick={() => setArmed(true)}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

function CompleteDialog({
  offer,
  onDone,
}: {
  offer: CasinoOfferRow;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [profit, setProfit] = useState(0);

  async function complete() {
    await api(`/api/casino/${offer.id}`, {
      method: "PATCH",
      json: { status: "completed", actualProfit: profit },
    });
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Complete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete offer</DialogTitle>
          <DialogDescription>
            Net result of the whole offer - stake, bonus and cashout together.
          </DialogDescription>
        </DialogHeader>
        <NumField label="Net profit" prefix="£" value={profit} onChange={setProfit} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void complete()}>Save result</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CasinoPage() {
  const { openCasinoLog } = useCasinoLog();
  const [offers, setOffers] = useState<CasinoOfferRow[] | null>(null);

  const load = useCallback(() => {
    api<{ offers: CasinoOfferRow[] }>("/api/casino")
      .then((r) => setOffers(r.offers))
      .catch(() => setOffers([]));
  }, []);

  useEffect(() => {
    load();
    // The global log dialog announces saves so the list stays current.
    window.addEventListener(CASINO_CHANGED_EVENT, load);
    return () => window.removeEventListener(CASINO_CHANGED_EVENT, load);
  }, [load]);

  async function remove(offer: CasinoOfferRow) {
    await api(`/api/casino/${offer.id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Casino"
        description="Wagering offers with honest EV - an expectation across many attempts, never a lock."
        helpId="casino"
        icon={Dices}
        action={
          <>
            <CasinoGameLibraryDialog />
            <Button size="sm" className="gap-1.5" onClick={openCasinoLog}>
              <Plus className="size-3.5" /> Log offer
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {offers == null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Dices}
            title="No casino offers yet"
            description="Log a wagering offer to get its EV verdict - bonus value minus the expected drag of cycling the wagering through the game."
          />
        ) : (
          offers.map((offer) => {
            const tier = varianceTier({
              wageringMultiplier: offer.wageringMultiplier,
              houseEdge: houseEdgeFromRtp(offer.rtp ?? DEFAULT_RTP),
              contributionPct: offer.contributionPct ?? undefined,
            });
            const settled = offer.status === "completed" && offer.actualProfit != null;
            return (
              <div
                key={offer.id}
                className="flex items-start gap-3 rounded-md border bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold">{offer.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {offer.casino ? `${offer.casino} · ` : ""}
                      {STATUS_LABEL[offer.status]} · {offer.wageringMultiplier}× wagering ·{" "}
                      {formatRtpPct(offer.rtp ?? DEFAULT_RTP)} RTP
                      {offer.game ? ` · play ${offer.game}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-medium tabular-nums">
                      EV {gbp(offer.expectedEv)}
                    </span>
                    <EvBasisBadge
                      basis={offer.rtp != null ? "estimated" : "heuristic"}
                      description={offer.rtp != null ? BASIS_COPY.entered : BASIS_COPY.defaulted}
                    />
                    <VarianceChip tier={tier} />
                  </div>
                  {settled ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expected {gbp(offer.expectedEv)} → Realised {gbp(offer.actualProfit!)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <CasinoSimDialog
                    offer={{
                      title: offer.title,
                      bonusAmount: offer.bonusAmount,
                      wageringMultiplier: offer.wageringMultiplier,
                      rtp: offer.rtp,
                      contributionPct: offer.contributionPct,
                      defaultVolatility: tier,
                    }}
                  />
                  {offer.status === "planned" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void api(`/api/casino/${offer.id}`, {
                          method: "PATCH",
                          json: { status: "active" },
                        }).then(load)
                      }
                    >
                      Start
                    </Button>
                  ) : null}
                  {offer.status === "planned" || offer.status === "active" ? (
                    <CompleteDialog offer={offer} onDone={load} />
                  ) : null}
                  <DeleteButton onConfirm={() => void remove(offer)} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </PageShell>
  );
}
