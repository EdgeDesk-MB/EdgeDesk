"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoneyFlow } from "@/components/money-flow";
import {
  OfferConfidenceBadge,
  type EdgeDataSource,
} from "@/components/offers/offer-confidence-badge";
import { fetchOfferEdgePlays } from "@/lib/offers/offer-edge-client";
import type { OfferEdgePlay } from "@/lib/offers/offer-edge.types";
import { formatDecimalOdds } from "@/lib/racing/odds";
import { formatClockTime } from "@/lib/time-format";
import { RegionFlag } from "@/components/region-flag";
import { captionHeading, edgeNavTag, edgePanel, listRowInteractive } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronRight, Zap } from "lucide-react";

const MAX_PLAYS = 3;

function PlayRow({ play, dataSource }: { play: OfferEdgePlay; dataSource?: EdgeDataSource }) {
  return (
    <li className="border-b border-border/60 last:border-0">
      <Link
        href={`/racing?race=${encodeURIComponent(play.raceExternalId)}`}
        className={cn("group flex items-start gap-1 px-2.5 py-2", listRowInteractive)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs font-semibold tabular-nums">
              {formatClockTime(play.startTime)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <RegionFlag code={play.region} />
              {play.course}
            </span>
            <OfferConfidenceBadge
              confidence={play.confidence}
              oddsSource={play.oddsSource}
              exchangeSource={play.exchangeSource}
              dataSource={dataSource}
            />
            <span className="ml-auto inline-flex items-baseline gap-1 text-xs">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">EV</span>
              <MoneyFlow value={play.totalEv} signColor signDisplay className="font-semibold" />
            </span>
          </div>

          <p className="mt-0.5 text-sm">
            Back <span className="font-semibold">{play.runner.name}</span>{" "}
            <span className="text-muted-foreground">
              at {formatDecimalOdds(play.runner.backDecimal)}
            </span>
          </p>

          {play.reasons.length > 0 && (
            <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {play.reasons.map((reason) => (
                <li key={reason} className="max-w-full">
                  {reason}
                </li>
              ))}
            </ul>
          )}

          {play.warnings.map((warning) => (
            <p key={warning} className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-px size-3 shrink-0 text-muted-foreground" aria-hidden />
              {warning}
            </p>
          ))}
        </div>
        <ChevronRight
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    </li>
  );
}

/**
 * Offer Edge for one racing offer: which races today, and which horse in each.
 *
 * Renders nothing until there is something worth showing, so an offer with no
 * qualifying races today leaves no empty shell on the card.
 */
export function OfferEdgePanel({
  offerId,
  eventDate,
}: {
  offerId: number;
  eventDate: string;
}) {
  const [plays, setPlays] = useState<OfferEdgePlay[] | null>(null);
  const [dataSource, setDataSource] = useState<EdgeDataSource | undefined>();

  useEffect(() => {
    let cancelled = false;
    fetchOfferEdgePlays(eventDate).then((data) => {
      if (cancelled) return;
      setPlays(data.plays.filter((p) => p.offerId === offerId).slice(0, MAX_PLAYS));
      setDataSource(data.source);
    });
    return () => {
      cancelled = true;
    };
  }, [offerId, eventDate]);

  if (!plays || plays.length === 0) return null;

  // The free-bet leg scales linearly with retention, so an EV resting on the
  // configured prior rather than the user's own settled history has to say so.
  const unmeasuredRetention = plays.every((p) => p.retentionSampleSize === 0);
  const assumedRetention = Math.round(plays[0].retention * 100);

  return (
    <div className={cn(edgePanel, "overflow-hidden")}>
      <div className="flex items-center gap-1.5 border-b border-border/50 px-2.5 py-1.5">
        <Zap className="size-3.5 text-edge" aria-hidden />
        <span className={edgeNavTag}>Edge</span>
        <span className={cn(captionHeading, "text-edge")}>Today</span>
      </div>
      <ul>
        {plays.map((play) => (
          <PlayRow
            key={`${play.raceExternalId}-${play.runner.horseId}`}
            play={play}
            dataSource={dataSource}
          />
        ))}
      </ul>
      {unmeasuredRetention && (
        <p className="border-t border-border/50 px-2.5 py-1.5 text-[10px] text-muted-foreground">
          Free-bet value assumes {assumedRetention}% retention until you have settled
          some free bets.
        </p>
      )}
    </div>
  );
}
