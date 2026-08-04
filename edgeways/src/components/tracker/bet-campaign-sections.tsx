"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BetLogTable } from "@/components/tracker/bet-log-table";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { PromoAwardsByBetId } from "@/lib/bet-outcomes";
import type { BetCampaignGroup } from "@/lib/bets/desk-queues";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import { formatOfferStatusDisplay } from "@/lib/offers/offer-expiry";
import { isOfferExpired, offerInactiveFigureClass } from "@/lib/offers/offer-inactive-ui";
import { campaignHeaderBand } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Gift, Tag } from "lucide-react";

export function BetCampaignSections({
  groups,
  events,
  promoAwards,
  offerById,
  eventById,
  highlightId,
  onEdit,
  onPatch,
  onPatchEvent,
  onLogged,
}: {
  groups: BetCampaignGroup[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
  onPatchEvent: (id: number, json: Record<string, unknown>, message: string) => void;
  onLogged: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section
          key={group.offerId ?? "orphans"}
          className="min-w-0 overflow-hidden rounded-lg ring-1 ring-border/50"
        >
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2",
              campaignHeaderBand
            )}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {group.offerId != null ? (
                  <Gift className="size-3.5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Tag className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {group.offer?.bookmaker ? <VenueBadge name={group.offer.bookmaker} /> : null}
                {group.offerId != null ? (
                  <Link
                    href={`/offers?highlight=${group.offerId}`}
                    className="truncate text-sm font-bold text-foreground hover:text-primary hover:underline"
                  >
                    {group.title}
                  </Link>
                ) : (
                  <h3 className="truncate text-sm font-bold text-foreground">{group.title}</h3>
                )}
                {group.offer ? (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {formatOfferStatusDisplay(group.offer)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {group.bets.length} bet{group.bets.length === 1 ? "" : "s"}
                {group.openCount > 0 ? ` · ${group.openCount} open` : ""}
                {group.needsLayCount > 0 ? ` · ${group.needsLayCount} unlayed` : ""}
              </p>
            </div>
            {group.offer ? (
              <div className="shrink-0 text-right text-xs tabular-nums">
                <div className="text-muted-foreground">
                  Campaign P&L
                  {Math.abs(group.offer.profit.openExpectedProfit) >= 0.005 ? (
                    <span className="ml-1 font-normal normal-case tracking-normal text-[10px]">
                      (incl. open)
                    </span>
                  ) : null}
                </div>
                <MoneyFlow
                  value={group.offer.profit.totalProfit}
                  signColor={!isOfferExpired(group.offer)}
                  className={cn(
                    "text-[1.1rem] font-bold leading-tight",
                    offerInactiveFigureClass(isOfferExpired(group.offer))
                  )}
                />
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <BetLogTable
              bets={group.bets}
              events={events}
              promoAwards={promoAwards}
              offerById={offerById}
              eventById={eventById}
              highlightId={highlightId}
              onEdit={onEdit}
              onPatch={onPatch}
              onPatchEvent={onPatchEvent}
              onLogged={onLogged}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
