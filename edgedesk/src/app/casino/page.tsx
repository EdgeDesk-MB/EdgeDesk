"use client";

/**
 * Casino desk (H2) - wagering-offer EV with variance honesty. EV here is an
 * expectation across many attempts, never a lock; every verdict carries a
 * variance tier and the copy never pretends a single session tracks the EV.
 * Casino money stays OUT of the matched P&L surfaces by design.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api } from "@/hooks/use-app-state";
import {
  casinoOfferEv,
  houseEdgeFromRtp,
  varianceTier,
  varianceTierCopy,
  DEFAULT_RTP,
  type CasinoVarianceTier,
} from "@/lib/calc/casino-ev";
import type { CasinoOfferRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const TIER_DOT: Record<CasinoVarianceTier, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-400",
  high: "bg-red-500",
};

const TIER_TEXT: Record<CasinoVarianceTier, string> = {
  low: "text-emerald-700 dark:text-emerald-300",
  medium: "text-amber-700 dark:text-amber-300",
  high: "text-red-700 dark:text-red-300",
};

function VarianceChip({ tier, className }: { tier: CasinoVarianceTier; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-flex cursor-default items-center gap-1", className)}
            aria-label={`Variance: ${varianceTierCopy(tier)}`}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", TIER_DOT[tier])} aria-hidden />
            <span className={cn("text-[9px] font-semibold uppercase tracking-wide", TIER_TEXT[tier])}>
              {tier} variance
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
          {varianceTierCopy(tier)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function gbp(value: number): string {
  return value < 0 ? `-£${Math.abs(value).toFixed(2)}` : `+£${value.toFixed(2)}`;
}

const BASIS_COPY = {
  entered: "Based on the game RTP you entered",
  defaulted: "Using the 96% RTP slot default - enter the game's RTP for accuracy",
} as const;

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

const STATUS_LABEL: Record<CasinoOfferRow["status"], string> = {
  planned: "Planned",
  active: "In progress",
  completed: "Completed",
  expired: "Expired",
};

function AddOfferDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [casino, setCasino] = useState("");
  const [title, setTitle] = useState("");
  const [bonus, setBonus] = useState(20);
  const [wagering, setWagering] = useState(35);
  const [rtpPct, setRtpPct] = useState(NaN); // percent; empty = 96% default
  const [contributionPct, setContributionPct] = useState(100);
  const [saving, setSaving] = useState(false);

  const rtpEntered = Number.isFinite(rtpPct);
  const verdict = useMemo(() => {
    const rtp = rtpEntered ? rtpPct / 100 : DEFAULT_RTP;
    const contribution = Number.isFinite(contributionPct)
      ? Math.min(1, Math.max(0.01, contributionPct / 100))
      : 1;
    return {
      ...casinoOfferEv({
        bonusAmount: bonus,
        wageringMultiplier: wagering,
        houseEdge: houseEdgeFromRtp(rtp),
        contributionPct: contribution,
      }),
      tier: varianceTier({
        wageringMultiplier: wagering,
        houseEdge: houseEdgeFromRtp(rtp),
        contributionPct: contribution,
      }),
    };
  }, [bonus, wagering, rtpPct, rtpEntered, contributionPct]);

  async function save() {
    if (!title.trim() || !(bonus > 0)) return;
    setSaving(true);
    try {
      await api("/api/casino", {
        method: "POST",
        json: {
          casino: casino.trim() || undefined,
          title: title.trim(),
          bonusAmount: bonus,
          wageringMultiplier: Number.isFinite(wagering) ? wagering : 0,
          rtp: rtpEntered ? rtpPct / 100 : null,
          contributionPct: Number.isFinite(contributionPct)
            ? Math.min(1, Math.max(0.01, contributionPct / 100))
            : null,
          status: "active",
        },
      });
      setOpen(false);
      setTitle("");
      onSaved();
    } catch {
      // Validation rejections leave the dialog open for correction.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> Log offer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a casino offer</DialogTitle>
          <DialogDescription>
            EV is an expectation across many attempts, never a lock - the variance tier says how
            far one session can stray.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="casino-name" className="text-xs text-muted-foreground">
              Casino
            </Label>
            <Input
              id="casino-name"
              value={casino}
              onChange={(e) => setCasino(e.target.value)}
              placeholder="e.g. Sky Vegas"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="casino-title" className="text-xs text-muted-foreground">
              Offer
            </Label>
            <Input
              id="casino-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Stake £10 get 50 spins"
            />
          </div>
          <NumField label="Bonus value" prefix="£" value={bonus} onChange={setBonus} min={0} />
          <NumField label="Wagering (×)" value={wagering} onChange={setWagering} min={0} step={1} />
          <NumField
            label="Game RTP (%)"
            value={rtpPct}
            onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
            min={50}
            step={0.1}
            placeholder="96 default"
            hint={rtpEntered ? undefined : "Using the 96% slot default"}
          />
          <NumField
            label="Contribution (%)"
            value={contributionPct}
            onChange={setContributionPct}
            min={1}
            step={5}
          />
        </div>
        <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Verdict
            </span>
            <span className="flex items-center gap-2">
              <EvBasisBadge
                basis={rtpEntered ? "estimated" : "heuristic"}
                description={rtpEntered ? BASIS_COPY.entered : BASIS_COPY.defaulted}
              />
              <VarianceChip tier={verdict.tier} />
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            EV {gbp(verdict.ev)}{" "}
            <span className="font-normal text-muted-foreground">
              · £{verdict.totalTurnover.toFixed(2)} turnover · £{verdict.wageringDrag.toFixed(2)}{" "}
              expected drag
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{varianceTierCopy(verdict.tier)}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !title.trim() || !(bonus > 0)}>
            Start offer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const [offers, setOffers] = useState<CasinoOfferRow[] | null>(null);

  const load = useCallback(() => {
    api<{ offers: CasinoOfferRow[] }>("/api/casino")
      .then((r) => setOffers(r.offers))
      .catch(() => setOffers([]));
  }, []);

  useEffect(() => {
    load();
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
        icon={Dices}
        action={<AddOfferDialog onSaved={load} />}
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
                      {Math.round((offer.rtp ?? DEFAULT_RTP) * 100)}% RTP
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
