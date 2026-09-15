"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/help/empty-state";
import { MoneyFlow } from "@/components/money-flow";
import { SportIcon } from "@/components/sport-icon";
import { VenueBadge } from "@/components/venue-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { outlineButtonGroup } from "@/components/layout/page-header-actions";
import {
  LinkEventSelect,
  LinkOfferSelect,
  linkableOffers,
} from "@/components/tracker/bet-link-controls";
import { ManualSettleDialog } from "@/components/tracker/manual-settle-dialog";
import { resultActionButtonClass } from "@/components/racing/racing-placings-dialog";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import { canManualSettleBet } from "@/lib/bets/manual-settle";
import { twoUpBothWinProfit, twoUpOddsAgainstPound } from "@/lib/bets/two-up-windfall";
import { formatGbp } from "@/lib/format-money";
import { formatBetSelection, isKnownSport, linkableEventsForSport } from "@/lib/markets";
import { sportDisplayLabel } from "@/lib/sports";
import { formatClockTime } from "@/lib/time-format";
import {
  canOpenFootballEpModel,
  earlyPayoutOfferLabel,
} from "@/lib/twoup/desk-view";
import type { EpBookieSetup } from "@/lib/twoup/bookie-offers";
import { betStatusBadgeVariant } from "@/lib/ui/status-badges";
import {
  campaignCardBadge,
  campaignCardHeader,
  campaignCardPnl,
  campaignCardPnlLabel,
  campaignCardStakeLine,
  campaignCardTitle,
  offerCampaignCardShell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";

function activeBetHeaderTint(expectedProfit: number | null): string | null {
  if (expectedProfit == null) return null;
  if (expectedProfit > 0.005) return "offer-header-tint-win";
  if (expectedProfit < -0.005) return "offer-header-tint-loss";
  return null;
}

function earlyPayoutOutcomeLabels(offerLabel: string): { miss: string; hit: string } {
  if (offerLabel === "1UP") return { miss: "If no 1UP", hit: "If 1UP" };
  if (offerLabel === "2UP") return { miss: "If no 2UP", hit: "If 2UP" };
  return { miss: "If it does not pay", hit: "If it pays" };
}

function earlyPayoutWindfallClause(offerLabel: string): string {
  if (offerLabel === "1UP") return "the selection goes one up, then fails to win";
  if (offerLabel === "2UP") return "the selection goes two up, then fails to win";
  if (offerLabel === "Early payout") return "the selection pays early, then fails to win";
  return `the selection is ${offerLabel}, then fails to win`;
}

export function TwoUpActiveBets({
  bets,
  events,
  offers,
  onBrowse,
  onOpenMatch,
  onPatch,
  onEdit,
  bookieSetup,
}: {
  bets: BetRow[];
  events: EventRow[];
  offers: OfferSummary[];
  onBrowse?: () => void;
  onOpenMatch?: (event: EventRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
  onEdit: (bet: BetRow) => void;
  bookieSetup?: EpBookieSetup | null;
}) {
  const [settleBetId, setSettleBetId] = useState<number | null>(null);
  const settleBet = bets.find((row) => row.id === settleBetId) ?? null;
  const offersToLink = linkableOffers(offers);

  if (bets.length === 0) {
    return (
      <EmptyState
        icon={Timer}
        title="No open early-payout bets"
        description="Track a match from Fixtures, then size football 2UP in Model. Open early-payout positions from any sport land here."
        action={onBrowse ? { label: "Browse fixtures", onClick: onBrowse } : undefined}
      />
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">Active early-payout bets</h2>
        <span className="text-xs text-muted-foreground">
          {bets.length === 1 ? "1 open" : `${bets.length} open`}
        </span>
      </div>
      <div className="flex flex-col gap-4.5">
        {bets.map((bet) => {
          const event = events.find((row) => row.id === bet.eventId);
          const offer = bet.offerId != null ? offers.find((row) => row.id === bet.offerId) : undefined;
          const eventSport =
            event?.sport && isKnownSport(event.sport) ? event.sport : null;
          const storedSport =
            (bet.sport && isKnownSport(bet.sport) ? bet.sport : null) ??
            (offer?.sport && isKnownSport(offer.sport) ? offer.sport : null);
          const knownSport = eventSport ?? storedSport;
          const offerLabel = earlyPayoutOfferLabel(bet, knownSport, bookieSetup);
          const twoUpProfit = twoUpBothWinProfit(bet);
          const oddsAgainst =
            twoUpProfit != null
              ? twoUpOddsAgainstPound(bet.expectedProfit, twoUpProfit)
              : null;
          const outcomeLabels = earlyPayoutOutcomeLabels(offerLabel);
          const footballModel = canOpenFootballEpModel(knownSport);
          const canLinkEvent =
            event == null &&
            storedSport != null &&
            (storedSport === "horse_racing" ||
              linkableEventsForSport(events, storedSport).length > 0);
          const headerTint = activeBetHeaderTint(bet.expectedProfit ?? null);
          const canManualSettle = canManualSettleBet(bet, event, offer?.sport);
          const clock =
            event?.startTime != null ? formatClockTime(event.startTime) : null;
          const live = event?.status === "live";
          const score =
            live && event
              ? `${event.homeScore ?? 0}–${event.awayScore ?? 0}`
              : null;
          const statusLabel = live
            ? "Live"
            : event?.status === "upcoming"
              ? "Upcoming"
              : "Open";
          const title = bet.selection
            ? formatBetSelection(
                bet.market,
                bet.selection,
                event?.homeTeam,
                event?.awayTeam
              )
            : bet.label;

          return (
            <Card
              key={bet.id}
              className={cn(offerCampaignCardShell, "flex-col gap-0 py-0")}
              {...(canManualSettle
                ? {
                    tabIndex: 0,
                    "data-open-bet-row": bet.id,
                    "aria-label": `Open bet: ${title}. Press S to set the result.`,
                  }
                : {})}
            >
              <div
                className={cn(
                  campaignCardHeader,
                  "px-(--card-spacing)",
                  headerTint ?? "bg-card"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {bet.bookmaker ? <VenueBadge name={bet.bookmaker} size="md" /> : null}
                      {eventSport ? (
                        <Badge variant="outline" className={cn("gap-1 text-[11px]", campaignCardBadge)}>
                          <SportIcon sport={eventSport} size={12} />
                          {sportDisplayLabel(eventSport)}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" className={cn("text-[11px]", campaignCardBadge)}>
                        {offerLabel}
                      </Badge>
                      <Badge
                        variant={live ? "success" : betStatusBadgeVariant(bet.status)}
                        className="text-[11px]"
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        campaignCardTitle,
                        "mt-0 min-w-0 text-pretty break-words text-[15px]"
                      )}
                    >
                      {title}
                    </p>
                    {event ? (
                      <p className="min-w-0 text-pretty break-words text-xs text-muted-foreground">
                        {[`${event.homeTeam} v ${event.awayTeam}`, clock, score]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {offer ? (
                      <p className="text-xs text-muted-foreground">
                        <Link href="/offers" className="text-primary-text hover:underline">
                          {offer.title.length > 28 ? `${offer.title.slice(0, 25)}…` : offer.title}
                        </Link>
                      </p>
                    ) : null}
                    {bet.backStake > 0 || bet.layStake > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {bet.backStake > 0 ? (
                          <p className={cn(campaignCardStakeLine, "mt-0")}>
                            {formatGbp(bet.backStake)} @ {bet.backOdds.toFixed(2)}
                          </p>
                        ) : null}
                        {bet.layStake > 0 ? (
                          <p className="text-[13px] font-medium tabular-nums text-muted-foreground">
                            {formatGbp(bet.layStake)} @ {bet.layOdds.toFixed(2)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {bet.offerId == null && offersToLink.length > 0 ? (
                      <div className="pt-1">
                        <LinkOfferSelect
                          offers={offersToLink}
                          onLink={(offerId) =>
                            onPatch(bet.id, { offerId }, "Linked to offer campaign")
                          }
                        />
                      </div>
                    ) : null}
                    {canLinkEvent && storedSport ? (
                      <div className="pt-1">
                        <LinkEventSelect
                          events={events}
                          bet={bet}
                          sport={storedSport}
                          onLink={(eventId, market, selection) =>
                            onPatch(
                              bet.id,
                              { eventId, market, selection },
                              "Linked to event"
                            )
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex flex-col items-end gap-2.5">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={campaignCardPnlLabel}>
                          {twoUpProfit != null ? outcomeLabels.miss : "Expected"}
                        </span>
                        <MoneyFlow
                          value={bet.expectedProfit ?? 0}
                          signColor
                          signDisplay
                          className={cn(campaignCardPnl, "text-[21px]")}
                        />
                      </div>
                      {twoUpProfit != null ? (
                        <div
                          className="flex flex-col items-end gap-0.5"
                          title={
                            oddsAgainst
                              ? `${formatGbp(Math.abs(bet.expectedProfit ?? 0))} to win ${formatGbp(twoUpProfit)} if ${earlyPayoutWindfallClause(offerLabel)}`
                              : `If ${earlyPayoutWindfallClause(offerLabel)}`
                          }
                        >
                          <span className={campaignCardPnlLabel}>{outcomeLabels.hit}</span>
                          <MoneyFlow
                            value={twoUpProfit}
                            signColor
                            signDisplay
                            className="text-[15px] font-semibold tabular-nums"
                          />
                          {oddsAgainst ? (
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {oddsAgainst.against}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-end gap-x-3 gap-y-2 border-t border-border/50 py-3.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]">
                <div className={cn(outlineButtonGroup, "shrink-0")}>
                  {canManualSettle ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-settle-trigger={bet.id}
                      className={resultActionButtonClass}
                      onClick={() => setSettleBetId(bet.id)}
                    >
                      Set result
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => onEdit(bet)}>
                    Edit
                  </Button>
                  {event && footballModel && onOpenMatch ? (
                    <Button variant="outline" size="sm" onClick={() => onOpenMatch(event)}>
                      Open model
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {settleBet ? (
        <ManualSettleDialog
          bet={settleBet}
          open
          showTrigger={false}
          onOpenChange={(next) => {
            if (!next) setSettleBetId(null);
          }}
          onSettle={(status, profit) => {
            onPatch(settleBet.id, { status, actualProfit: profit }, "Bet settled");
            setSettleBetId(null);
          }}
        />
      ) : null}
    </section>
  );
}
