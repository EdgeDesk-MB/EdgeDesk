"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import type { OfferSummary } from "@/lib/services/offers.types";
import { formatGbp } from "@/lib/format-money";
import { isOfferExpired, offerInactiveFigureClass } from "@/lib/offers/offer-inactive-ui";
import { cn } from "@/lib/utils";
import {
  listRow,
  sectionDescription,
  sectionTitle,
  selectionSubtle,
} from "@/lib/ui/surface-styles";
import { Gift, Tag } from "lucide-react";

function RetentionStat({
  awarded,
  amount,
  inactive,
}: {
  awarded: boolean;
  amount: number | null;
  inactive?: boolean;
}) {
  if (!awarded) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={cn(
        "font-medium text-violet-700 dark:text-violet-300 tabular-nums",
        offerInactiveFigureClass(inactive)
      )}
    >
      {amount != null ? formatGbp(amount) : "-"} retained
    </span>
  );
}

function OfferPnlRow({
  offer,
  plain,
}: {
  offer: OfferSummary;
  plain?: boolean;
}) {
  const { profit } = offer;
  const isRacing = offer.sport === "horse_racing";
  const inactive = isOfferExpired(offer);
  const inactiveFigure = offerInactiveFigureClass(inactive);

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-2.5 text-xs",
        plain ? listRow : "rounded-md border px-2.5 py-2 transition-colors hover:bg-selection-subtle"
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate font-medium">{offer.title}</p>
          {isRacing && (
            <Badge variant="outline" className="h-4 px-1 text-[9px]">
              Racing
            </Badge>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted-foreground">
          {offer.bookmaker ? <VenueBadge name={offer.bookmaker} /> : <span>Any bookie</span>}
          <span>
            · {offer.betCount} bet{offer.betCount === 1 ? "" : "s"}
            {offer.openBets > 0 ? ` · ${offer.openBets} open` : ""}
          </span>
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
          {(profit.qualifyingSettledCount > 0 || profit.qualifyingOpenCount > 0) && (
            <span>
              <span className="text-muted-foreground">Qual loss </span>
              {profit.qualifyingOpenCount > 0 && profit.qualifyingSettledCount === 0 ? (
                <span className="text-muted-foreground">open</span>
              ) : (
                <MoneyFlow
                  value={profit.qualifyingProfit}
                  signColor={!inactive}
                  className={cn("inline font-medium", inactiveFigure)}
                />
              )}
            </span>
          )}
          {isRacing && (
            <span>
              <span className="text-muted-foreground">Place-refund </span>
              {profit.freeBetStage === "awaiting_result" ? (
                <span className="text-muted-foreground">awaiting</span>
              ) : profit.freeBetAwarded ? (
                <RetentionStat
                  awarded
                  amount={profit.freeBetAwardAmount}
                  inactive={inactive}
                />
              ) : profit.freeBetStage === "not_awarded" ? (
                <span className="text-muted-foreground">not triggered</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </span>
          )}
          {profit.freeBetSettledCount > 0 && (
            <span>
              <span className="text-muted-foreground">FB P&amp;L </span>
              <MoneyFlow
                value={profit.freeBetProfit}
                signColor={!inactive}
                className={cn("inline font-medium", inactiveFigure)}
              />
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <MoneyFlow
          value={profit.totalProfit}
          signColor={!inactive}
          className={cn("text-sm font-semibold", inactiveFigure)}
        />
      </div>
    </div>
  );
}

export function OfferPnlSlice({
  offers,
  className,
  compact,
  variant = "card",
}: {
  offers: OfferSummary[];
  className?: string;
  compact?: boolean;
  /** Flat layout for dashboard dialog - no nested card/header */
  variant?: "card" | "plain";
}) {
  const active = offers.filter((o) => o.status === "active" || o.betCount > 0);
  const withActivity = active.filter(
    (o) => o.betCount > 0 || o.status === "active"
  );

  const byBookie = new Map<string, { qual: number; total: number; count: number }>();
  for (const offer of withActivity) {
    const key = offer.bookmaker?.trim() || "Any bookie";
    const prev = byBookie.get(key) ?? { qual: 0, total: 0, count: 0 };
    byBookie.set(key, {
      qual: prev.qual + offer.profit.qualifyingProfit,
      total: prev.total + offer.profit.totalProfit,
      count: prev.count + offer.betCount,
    });
  }

  const bookieRows = [...byBookie.entries()]
    .filter(([, v]) => v.count > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, compact ? 3 : 5);

  const offerRows = withActivity
    .sort((a, b) => b.profit.totalProfit - a.profit.totalProfit)
    .slice(0, variant === "plain" ? undefined : compact ? 4 : 6);

  if (offerRows.length === 0) return null;

  const totals = withActivity.reduce(
    (acc, o) => ({
      qual: acc.qual + o.profit.qualifyingProfit,
      total: acc.total + o.profit.totalProfit,
      awarded: acc.awarded + (o.profit.freeBetAwarded ? 1 : 0),
    }),
    { qual: 0, total: 0, awarded: 0 }
  );

  const statStrip = (
    <div className="grid grid-cols-3 gap-3">
      <div className={cn("rounded-md px-3 py-2.5", selectionSubtle)}>
        <p className={sectionDescription}>Qualifying</p>
        <MoneyFlow value={totals.qual} signColor className="text-lg font-semibold" />
      </div>
      <div className={cn("rounded-md px-3 py-2.5", selectionSubtle)}>
        <p className={sectionDescription}>Total offer P&amp;L</p>
        <MoneyFlow value={totals.total} signColor className="text-lg font-semibold" />
      </div>
      <div className={cn("rounded-md px-3 py-2.5", selectionSubtle)}>
        <p className={sectionDescription}>FB awarded</p>
        <p className="text-lg font-semibold tabular-nums">
          {totals.awarded}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            / {withActivity.length}
          </span>
        </p>
      </div>
    </div>
  );

  const offerList = (
    <div className={cn(variant === "plain" && "overflow-hidden rounded-lg border border-border/80")}>
      {offerRows.map((offer) => (
        <OfferPnlRow key={offer.id} offer={offer} plain={variant === "plain"} />
      ))}
    </div>
  );

  const awaitingNote = withActivity.some((o) => o.profit.freeBetStage === "awaiting_result") && (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[11px] text-muted-foreground",
        variant === "plain" && cn("rounded-md px-3 py-2", selectionSubtle)
      )}
    >
      <Gift className="size-3 shrink-0" />
      Open qualifying bets awaiting race results for place-refund triggers.
    </p>
  );

  if (variant === "plain") {
    return (
      <div className={cn("space-y-4", className)}>
        {statStrip}
        {bookieRows.length > 1 && (
          <div>
            <p className={cn(sectionTitle, "mb-2 px-0.5")}>By bookie</p>
            <div className="overflow-hidden rounded-lg border border-border/80">
              {bookieRows.map(([bookie, stats]) => (
                <div
                  key={bookie}
                  className={cn("flex items-center justify-between gap-2 px-3 py-2 text-xs", listRow)}
                >
                  <span className="font-medium">
                    {bookie === "Any bookie" ? bookie : <VenueBadge name={bookie} />}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">
                      qual <MoneyFlow value={stats.qual} signColor className="inline" />
                    </span>
                    <MoneyFlow value={stats.total} signColor className="font-semibold" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {offerList}
        {awaitingNote}
      </div>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-4 text-primary" />
              Offer P&amp;L
            </CardTitle>
            <CardDescription compact>
              Qualifying loss, place-refund retention and free-bet conversion by offer.
            </CardDescription>
          </div>
          <Link
            href="/offers"
            className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            All offers →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {statStrip}

        {bookieRows.length > 1 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              By bookie
            </p>
            <div className="space-y-1">
              {bookieRows.map(([bookie, stats]) => (
                <div
                  key={bookie}
                  className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium">
                    {bookie === "Any bookie" ? bookie : <VenueBadge name={bookie} />}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">
                      qual <MoneyFlow value={stats.qual} signColor className="inline" />
                    </span>
                    <MoneyFlow value={stats.total} signColor className="font-semibold" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1">
          {offerRows.map((offer) => (
            <OfferPnlRow key={offer.id} offer={offer} />
          ))}
        </div>

        {awaitingNote}
      </CardContent>
    </Card>
  );
}
