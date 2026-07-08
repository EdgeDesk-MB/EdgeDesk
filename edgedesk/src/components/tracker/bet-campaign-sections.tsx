"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BetLogTable } from "@/components/tracker/bet-log-table";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers";
import type { PromoAwardsByBetId } from "@/lib/bet-outcomes";
import type { BetCampaignGroup } from "@/lib/bets/desk-queues";
import { MoneyFlow } from "@/components/money-flow";
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
}: {
  groups: BetCampaignGroup[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.offerId ?? "orphans"} className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {group.offerId != null ? (
                  <Gift className="size-3.5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Tag className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
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
                {group.offer?.bookmaker ? (
                  <span className="text-xs text-muted-foreground">{group.offer.bookmaker}</span>
                ) : null}
                {group.offer ? (
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {group.offer.status}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {group.bets.length} bet{group.bets.length === 1 ? "" : "s"}
                {group.openCount > 0 ? ` · ${group.openCount} open` : ""}
                {group.needsLayCount > 0 ? ` · ${group.needsLayCount} need lay` : ""}
              </p>
            </div>
            {group.offer ? (
              <div className="shrink-0 text-right text-xs tabular-nums">
                <div className="text-muted-foreground">Campaign P&L</div>
                <MoneyFlow
                  value={group.offer.profit.totalProfit}
                  signColor
                  className="text-sm font-semibold"
                />
              </div>
            ) : null}
          </div>
          <div className={cn("overflow-x-auto rounded-md ring-1 ring-border/50")}>
            <BetLogTable
              bets={group.bets}
              events={events}
              promoAwards={promoAwards}
              offerById={offerById}
              eventById={eventById}
              highlightId={highlightId}
              onEdit={onEdit}
              onPatch={onPatch}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
