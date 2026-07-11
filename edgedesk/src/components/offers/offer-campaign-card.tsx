"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoneyFlow } from "@/components/money-flow";
import { api } from "@/hooks/use-app-state";
import type { OfferSummary, OfferProfitBreakdown } from "@/lib/services/offers.types";
import {
  canManuallyCompleteOffer,
  offerManualCompleteBlockedReason,
} from "@/lib/offers/offer-complete";
import {
  offerCategoryFromSport,
  offerCategoryLabel,
} from "@/lib/offers/offer-categories";
import { formatOfferExpiry } from "@/lib/offers/offer-terms";
import { buildCampaignDetailsContext } from "@/lib/offers/offer-campaign-details";
import { offerIssueStatusLabel, effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { formatGbp } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { offerStatusBadgeVariant } from "@/lib/ui/status-badges";
import { OfferPipelineStrip } from "@/components/offers/offer-pipeline-strip";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import {
  isOfferExpired,
  offerInactiveFigureClass,
} from "@/lib/offers/offer-inactive-ui";
import { VenueBadge } from "@/components/venue-badge";
import {
  offerFreeBetAmount,
  offerHasFreeBetReward,
} from "@/lib/offers/offer-ui";
import { outlineButtonGroup } from "@/components/layout/page-header-actions";
import { Check, ChevronDown, Eye, Pencil, Sparkles, Trash2 } from "lucide-react";

export function OfferCampaignCard({
  offer,
  highlighted,
  nextActionLabel,
  nextActionDetail,
  onRefresh,
  onEdit,
  onView,
  defaultDetailsOpen = false,
}: {
  offer: OfferSummary;
  highlighted?: boolean;
  nextActionLabel?: string | null;
  nextActionDetail?: string | null;
  onRefresh: () => void;
  onEdit: (offer: OfferSummary) => void;
  onView?: (offer: OfferSummary) => void;
  defaultDetailsOpen?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);
  const {
    rulesSummary,
    descriptionLine,
    uniqueImportant,
    scopeLine,
  } = buildCampaignDetailsContext(offer);
  const categoryId = offerCategoryFromSport(offer.sport);
  const categoryLabel = offerCategoryLabel(offer.sport);
  const hasFreeBet = offerHasFreeBetReward(offer);
  const freeBetAmt = offerFreeBetAmount(offer);

  const expiryMs = effectiveOfferExpiryMs(offer);

  const hasProfitLines = (() => {
    const p = offer.profit;
    return (
      p.qualifyingSettledCount > 0 ||
      p.qualifyingOpenCount > 0 ||
      p.freeBetStage !== "none" ||
      p.freeBetAwarded ||
      p.freeBetSettledCount > 0 ||
      p.freeBetOpenCount > 0
    );
  })();

  const hasDetails =
    Boolean(rulesSummary) ||
    Boolean(descriptionLine) ||
    Boolean(uniqueImportant) ||
    Boolean(scopeLine) ||
    hasProfitLines;

  const detailsSummary = [
    rulesSummary?.split(" · ")[0] ?? descriptionLine?.slice(0, 48) ?? null,
    uniqueImportant?.split("\n")[0]?.slice(0, 48) ?? null,
    hasProfitLines ? "Profit & Loss breakdown" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  async function markComplete() {
    try {
      await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "completed" } });
      toast.success("Offer marked complete");
      onRefresh();
    } catch (e) {
      toast.error("Could not complete offer", { description: String(e) });
    }
  }

  async function markExpired() {
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "expired" } });
    toast.success("Offer marked expired");
    onRefresh();
  }

  async function reactivate() {
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "active" } });
    toast.success("Offer reactivated");
    onRefresh();
  }

  const headerTintValue =
    Math.abs(offer.profit.totalProfit) > 0.005
      ? offer.profit.totalProfit
      : (offer.expectedProfit ?? offer.expectedFromBets);
  const isExpired = isOfferExpired(offer);
  const headerTintClass = isExpired
    ? "offer-header-tint-expired"
    : headerTintValue > 0.005
      ? "offer-header-tint-win"
      : headerTintValue < -0.005
        ? "offer-header-tint-loss"
        : null;
  const inactiveFigure = offerInactiveFigureClass(isExpired);
  const canComplete = canManuallyCompleteOffer(offer);
  const completeBlockedReason = offerManualCompleteBlockedReason(offer);
  const issueStatusLabel = offerIssueStatusLabel(offer);

  function handleCardActivate() {
    onView?.(offer);
  }

  function stopCardActivate(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
  }

  return (
    <Card
      id={`offer-card-${offer.id}`}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onClick={onView ? handleCardActivate : undefined}
      onKeyDown={
        onView
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardActivate();
              }
            }
          : undefined
      }
      className={cn(
        "offer-campaign-card gap-0 overflow-hidden py-0 dark:ring-[color-mix(in_oklch,black_55%,var(--border))] dark:ring-opacity-100",
        highlighted && "bet-row-highlight",
        onView && "cursor-pointer transition-[box-shadow] hover:ring-foreground/20"
      )}
    >
      <CardHeader
        className={cn("space-y-0 pt-(--card-spacing) pb-3", headerTintClass ?? "bg-card")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {offer.bookmaker ? <VenueBadge name={offer.bookmaker} size="md" /> : null}
              {issueStatusLabel ? (
                <Badge variant={offerStatusBadgeVariant(offer.status)}>
                  {issueStatusLabel}
                </Badge>
              ) : null}
              <Badge variant="outline" className="gap-1 font-normal">
                <OfferCategoryIcon category={categoryId} size={12} className="opacity-80" />
                {categoryLabel}
              </Badge>
              {hasFreeBet ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                >
                  <Sparkles className="size-3" />
                  {freeBetAmt != null ? `${formatGbp(freeBetAmt)} FB` : "Free bet"}
                </Badge>
              ) : null}
            </div>
            <CardTitle className="mt-2 text-xl font-bold leading-snug text-foreground">
              {offer.title}
            </CardTitle>
            {nextActionDetail ? (
              <p className="mt-1 text-xs text-primary/90">{nextActionDetail}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {(() => {
              const expected = offer.expectedProfit ?? offer.expectedFromBets;
              const actual = offer.profit.totalProfit;
              const hasActual = Math.abs(actual) > 0.005;
              if (expected > 0.005 && hasActual) {
                return (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <MoneyFlow
                      value={actual}
                      signColor={!isExpired}
                      className={cn("text-xl font-bold tabular-nums", inactiveFigure)}
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Exp. profit{" "}
                      <MoneyFlow
                        value={expected}
                        signColor={false}
                        className={cn(
                          "inline font-medium tabular-nums",
                          isExpired
                            ? inactiveFigure
                            : "text-emerald-600 dark:text-emerald-400"
                        )}
                      />
                    </p>
                  </>
                );
              }
              if (expected > 0.005) {
                return (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Exp. profit
                    </p>
                    <MoneyFlow
                      value={expected}
                      signColor={false}
                      className={cn(
                        "text-xl font-bold tabular-nums",
                        isExpired
                          ? inactiveFigure
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    />
                  </>
                );
              }
              return (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                  <MoneyFlow
                    value={actual}
                    signColor={!isExpired}
                    className={cn("text-lg font-bold", inactiveFigure)}
                  />
                </>
              );
            })()}
          </div>
        </div>

        <OfferPipelineStrip offer={offer} className="mt-3" />
      </CardHeader>

      {hasDetails ? (
        <div
          className="offer-card-details border-t border-border/50"
          onClick={stopCardActivate}
          onKeyDown={stopCardActivate}
        >
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex w-full min-h-9 items-baseline gap-2 px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-foreground/5"
          >
            <span className="shrink-0 text-xs font-semibold tracking-wide text-foreground">
              Details
            </span>
            {!detailsOpen && detailsSummary ? (
              <span className="min-w-0 flex-1 text-[11px] leading-normal text-muted-foreground line-clamp-2">
                {detailsSummary}
              </span>
            ) : (
              <span className="min-w-0 flex-1" aria-hidden />
            )}
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 self-center text-muted-foreground transition-transform",
                detailsOpen && "rotate-180"
              )}
            />
          </button>
          {detailsOpen ? (
            <div className="flex flex-col gap-2 border-t border-border/50 px-(--card-spacing) py-2.5">
              {rulesSummary ? (
                <p className="text-xs leading-normal text-muted-foreground">{rulesSummary}</p>
              ) : null}
              {descriptionLine ? (
                <p className="text-xs leading-snug text-muted-foreground">{descriptionLine}</p>
              ) : null}
              {uniqueImportant ? (
                <p className="whitespace-pre-line rounded-md border border-amber-500/25 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                  {uniqueImportant}
                </p>
              ) : null}
              {scopeLine ? (
                <p className="text-[11px] text-muted-foreground">{scopeLine}</p>
              ) : null}
              <OfferProfitLines profit={offer.profit} inactive={isExpired} />
            </div>
          ) : null}
        </div>
      ) : null}

      <CardContent
        className="offer-card-footer flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-2.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]"
        onClick={stopCardActivate}
        onKeyDown={stopCardActivate}
      >
        <span className="text-xs text-muted-foreground">
          {offer.betCount} bet{offer.betCount === 1 ? "" : "s"}
          {offer.openBets > 0 ? ` · ${offer.openBets} open` : ""}
          {expiryMs ? ` · expires ${formatOfferExpiry(expiryMs)}` : ""}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(offer.status === "active" || offer.status === "planned") && (
            <Button size="sm" variant="ghost" onClick={() => void markExpired()}>
              Expire
            </Button>
          )}
          <DeleteOfferDialog offer={offer} onDeleted={onRefresh} />
          <div className={outlineButtonGroup}>
            <Button size="sm" variant="outline" onClick={() => onEdit(offer)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            {onView ? (
              <Button size="sm" variant="outline" onClick={() => onView(offer)}>
                <Eye className="size-3.5" /> View
              </Button>
            ) : null}
            {offer.status === "active" && offer.betCount > 0 ? (
              <span title={completeBlockedReason ?? undefined} className="inline-flex">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void markComplete()}
                  disabled={!canComplete}
                >
                  <Check className="size-3.5 text-violet-600 dark:text-violet-400" />
                  Complete
                </Button>
              </span>
            ) : null}
          </div>
          {(offer.status === "completed" || offer.status === "expired") && (
            <Button size="sm" variant="ghost" onClick={() => void reactivate()}>
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OfferProfitLines({
  profit,
  inactive,
}: {
  profit: OfferProfitBreakdown;
  inactive?: boolean;
}) {
  const inactiveFigure = offerInactiveFigureClass(inactive);
  const hasQualifying =
    profit.qualifyingSettledCount > 0 || profit.qualifyingOpenCount > 0;
  const hasFreeBetTrack =
    profit.freeBetStage !== "none" ||
    profit.freeBetAwarded ||
    profit.freeBetSettledCount > 0 ||
    profit.freeBetOpenCount > 0;

  if (!hasQualifying && !hasFreeBetTrack) return null;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
      {hasQualifying && (
        <div className="flex items-start justify-between gap-3 py-0.5">
          <span className="text-muted-foreground">Qualifying</span>
          <span className="text-right">
            {profit.qualifyingOpenCount > 0 && profit.qualifyingSettledCount === 0 ? (
              <span className="text-muted-foreground">Open</span>
            ) : (
              <MoneyFlow
                value={profit.qualifyingProfit}
                signColor={!inactive}
                className={cn("font-medium", inactiveFigure)}
              />
            )}
          </span>
        </div>
      )}

      {hasFreeBetTrack && (
        <>
          <div className="flex items-start justify-between gap-3 py-0.5">
            <span className="text-muted-foreground">Free bet</span>
            <span className="text-right">
              {profit.freeBetAwarded ? (
                <span
                  className={cn(
                    "font-medium text-violet-700 dark:text-violet-300",
                    inactiveFigure
                  )}
                >
                  {formatGbp(profit.freeBetAwardAmount ?? 0)} awarded
                  {profit.freeBetAwardReason ? ` · ${profit.freeBetAwardReason}` : ""}
                </span>
              ) : profit.freeBetStage === "awaiting_result" ? (
                <span className="text-muted-foreground">Awaiting result</span>
              ) : profit.freeBetStage === "not_awarded" ? (
                <span className="text-muted-foreground">Not awarded</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </span>
          </div>

          {(profit.freeBetStage === "in_use" ||
            profit.freeBetStage === "settled" ||
            profit.freeBetSettledCount > 0 ||
            profit.freeBetOpenCount > 0) && (
            <div className="flex items-start justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">Conversion</span>
              <span className="text-right">
                {profit.freeBetOpenCount > 0 && profit.freeBetSettledCount === 0 ? (
                  <span className="text-muted-foreground">Open</span>
                ) : (
                  <MoneyFlow
                    value={profit.freeBetProfit}
                    signColor={!inactive}
                    className={cn("font-medium", inactiveFigure)}
                  />
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DeleteOfferDialog({
  offer,
  onDeleted,
}: {
  offer: OfferSummary;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    setBusy(true);
    try {
      await api(`/api/offers/${offer.id}`, { method: "DELETE" });
      toast.success("Offer deleted");
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error("Could not delete offer", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete offer?</DialogTitle>
          <DialogDescription>
            This permanently removes &ldquo;{offer.title}&rdquo;.
            {offer.betCount > 0
              ? ` ${offer.betCount} linked bet${offer.betCount === 1 ? "" : "s"} will be unlinked but not deleted.`
              : ""}{" "}
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
