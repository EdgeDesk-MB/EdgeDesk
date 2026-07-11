"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NumField } from "@/components/calc/num-field";
import { MoneyFlow } from "@/components/money-flow";
import { FreeBetAwardBadge } from "@/components/free-bet-award-badge";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import { formatEventStatus, formatEventTitle } from "@/lib/events";
import { SportEventBlock, SportIcon } from "@/components/sport-icon";
import { previewAiTriggers, settlePartialOutcome, type SettledBetStatus } from "@/lib/calc";
import { betRaceOutcome, type PromoAwardsByBetId } from "@/lib/bet-outcomes";
import { parseRaceResults } from "@/lib/racing";
import {
  formatBetSelection,
  inferSportFromBet,
  isAutoSettleMarket,
  MARKET_LABELS,
} from "@/lib/markets";
import { formatGbp } from "@/lib/format-money";
import {
  isBetCancelled,
  isOfferExpired,
  offerInactiveFigureClass,
} from "@/lib/offers/offer-inactive-ui";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { betStatusBadgeVariant, formatPillLabel } from "@/lib/ui/status-badges";
import { cn } from "@/lib/utils";
import { Link2, Pencil, RotateCcw, Sparkles } from "lucide-react";

const stickyActionsHead =
  "sticky right-0 z-20 w-14 border-l border-border/60 bg-card px-1 shadow-[-6px_0_10px_-6px_hsl(var(--border)/0.5)]";

const stickyActionsCell =
  "sticky right-0 z-10 w-14 border-l border-border/60 bg-card px-1 shadow-[-6px_0_10px_-6px_hsl(var(--border)/0.5)] group-hover:bg-selection-subtle";

export function BetLogTable({
  bets,
  events,
  promoAwards,
  offerById,
  eventById,
  highlightId,
  onEdit,
  onPatch,
}: {
  bets: BetRow[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
}) {
  const linkableOffers = [...offerById.values()]
    .filter(
      (o) =>
        o.status === "active" ||
        o.status === "planned" ||
        o.profit.freeBetStage === "awarded"
    )
    .sort((a, b) => {
      const aAward = a.profit.freeBetStage === "awarded" ? 0 : 1;
      const bAward = b.profit.freeBetStage === "awarded" ? 0 : 1;
      if (aAward !== bAward) return aAward - bAward;
      return b.createdAt - a.createdAt;
    });

  return (
    <Table className="min-w-[720px] table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(tableHeaderCell, "w-[26%]")}>Bet</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[20%]")}>Event</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[16%]")}>Market</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[14%] text-right")}>Stakes</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[12%]")}>Result</TableHead>
          <TableHead className={cn(tableHeaderCell, stickyActionsHead, "text-right")}>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bets.map((bet) => {
          const event = bet.eventId ? eventById.get(bet.eventId) : undefined;
          const raceOutcome = betRaceOutcome(bet, event, promoAwards);
          const offer = bet.offerId != null ? offerById.get(bet.offerId) : undefined;
          const inactiveFigure = offerInactiveFigureClass(
            isBetCancelled(bet) || (offer != null && isOfferExpired(offer))
          );
          const triggers = previewAiTriggers({
            label: bet.label,
            triggerText: bet.triggerText ?? "",
          }).lines;

          return (
            <TableRow
              key={bet.id}
              id={`bet-row-${bet.id}`}
              className={cn("group", highlightId === bet.id && "bet-row-highlight")}
            >
              <TableCell className={cn(tableBodyCell, "whitespace-normal align-top")}>
                <div className="line-clamp-2 font-medium leading-snug">{bet.label}</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {bet.betType.replace("_", " ")}
                  {bet.earlyPayout ? " · 2UP" : ""}
                  {offer && (
                    <>
                      {" · "}
                      <Link href="/offers" className="text-primary hover:underline">
                        {offer.title.length > 28 ? `${offer.title.slice(0, 25)}…` : offer.title}
                      </Link>
                    </>
                  )}
                </div>
                {bet.offerId == null && linkableOffers.length > 0 && (
                  <div className="mt-1">
                    <LinkOfferSelect
                      offers={linkableOffers}
                      onLink={(offerId) =>
                        onPatch(bet.id, { offerId }, "Linked to offer campaign")
                      }
                    />
                  </div>
                )}
                {(bet.triggerText || triggers.length > 0) && (
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    <Sparkles className="mr-0.5 inline size-3 shrink-0 text-violet-500" />
                    {bet.triggerText || triggers[0]}
                  </div>
                )}
              </TableCell>

              <TableCell className={cn(tableBodyCell, "whitespace-normal align-top")}>
                {event ? (
                  <SportEventBlock
                    sport={event.sport}
                    title={formatEventTitle(event)}
                    titleClassName="text-sm leading-snug"
                    iconSize={14}
                  >
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {raceOutcome?.positionLabel ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                          <span>{raceOutcome.positionLabel}</span>
                          {raceOutcome.promoAward && (
                            <FreeBetAwardBadge
                              amount={raceOutcome.promoAward.amount}
                              reason={raceOutcome.promoAward.reason}
                              compact
                            />
                          )}
                        </span>
                      ) : (
                        formatEventStatus(event, parseRaceResults(event.goals))
                      )}
                    </div>
                  </SportEventBlock>
                ) : (
                  <LinkEventSelect
                    events={events}
                    onLink={(eventId, market, selection) =>
                      onPatch(bet.id, { eventId, market, selection }, "Linked to event")
                    }
                    bet={bet}
                  />
                )}
              </TableCell>

              <TableCell className={cn(tableBodyCell, "whitespace-normal align-top text-xs leading-snug")}>
                <div className="line-clamp-2">
                  {MARKET_LABELS[bet.market] ?? bet.market}
                  {bet.selection
                    ? ` · ${formatBetSelection(
                        bet.market,
                        bet.selection,
                        event?.homeTeam,
                        event?.awayTeam
                      )}`
                    : ""}
                </div>
              </TableCell>

              <TableCell
                className={cn(
                  tableBodyCell,
                  "whitespace-normal align-top text-right text-xs tabular-nums",
                  inactiveFigure
                )}
              >
                {bet.backStake > 0 ? (
                  <div>{formatGbp(bet.backStake)} @ {bet.backOdds.toFixed(2)}</div>
                ) : (
                  <div className="text-muted-foreground">-</div>
                )}
                {bet.layStake > 0 ? (
                  <div className="mt-0.5 text-muted-foreground">
                    {formatGbp(bet.layStake)} @ {bet.layOdds.toFixed(2)}
                  </div>
                ) : null}
              </TableCell>

              <TableCell className={cn(tableBodyCell, "whitespace-normal align-top")}>
                <Badge variant={betStatusBadgeVariant(bet.status)} className="text-[10px]">
                  {bet.status === "early_payout"
                    ? "2UP paid"
                    : bet.status === "half_win"
                      ? "½ win"
                      : bet.status === "half_lose"
                        ? "½ lose"
                        : formatPillLabel(bet.status)}
                </Badge>
                <div className={cn("mt-1.5 font-medium tabular-nums", inactiveFigure)}>
                  {bet.actualProfit != null ? (
                    <MoneyFlow
                      value={bet.actualProfit}
                      signColor={!isBetCancelled(bet)}
                      signDisplay
                      className="text-sm"
                    />
                  ) : bet.expectedProfit != null ? (
                    <span className="text-xs text-muted-foreground">
                      exp. {formatGbp(bet.expectedProfit)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </TableCell>

              <TableCell
                className={cn(
                  tableBodyCell,
                  stickyActionsCell,
                  "align-top",
                  highlightId === bet.id && "bet-row-highlight"
                )}
              >
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => onEdit(bet)}
                    aria-label="Edit bet"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {bet.status === "open" &&
                    !bet.triggerRule &&
                    !isAutoSettleMarket(
                      inferSportFromBet(bet.market, event?.sport),
                      bet.market
                    ) && (
                      <ManualSettleDialog
                        bet={bet}
                        onSettle={(status, profit) =>
                          onPatch(bet.id, { status, actualProfit: profit }, "Bet settled")
                        }
                      />
                    )}
                  {bet.status !== "open" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground"
                      onClick={() => onPatch(bet.id, { status: "open" }, "Bet reopened")}
                      aria-label="Reopen bet"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function LinkOfferSelect({
  offers,
  onLink,
}: {
  offers: OfferSummary[];
  onLink: (offerId: number) => void;
}) {
  return (
    <Select onValueChange={(v) => onLink(Number(v))}>
      <SelectTrigger size="sm" className="h-7 w-full max-w-[11rem] text-[11px]">
        <span className="flex items-center gap-1 text-primary">
          <Link2 className="size-3 shrink-0" /> Link to offer
        </span>
      </SelectTrigger>
      <SelectContent>
        {offers.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            <span className="flex flex-col gap-0.5 text-left">
              <span className="truncate font-medium">
                {o.title.length > 36 ? `${o.title.slice(0, 33)}…` : o.title}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {o.bookmaker ?? "No bookie"}
                {o.profit.freeBetStage === "awarded" && o.profit.freeBetAwardAmount != null
                  ? ` · £${o.profit.freeBetAwardAmount.toFixed(0)} FB ready`
                  : ` · ${o.status}`}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LinkEventSelect({
  events,
  bet,
  onLink,
}: {
  events: EventRow[];
  bet: BetRow;
  onLink: (eventId: number, market: string, selection: string) => void;
}) {
  const linkable = events.filter(
    (e) => e.sport === "horse_racing" || e.status !== "finished"
  );
  if (linkable.length === 0)
    return <span className="text-xs text-muted-foreground">no event</span>;
  return (
    <Select onValueChange={(v) => onLink(Number(v), bet.market, bet.selection)}>
      <SelectTrigger size="sm" className="h-8 w-full max-w-[10rem] text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Link2 className="size-3 shrink-0" /> Link event
        </span>
      </SelectTrigger>
      <SelectContent>
        {linkable.map((e) => (
          <SelectItem key={e.id} value={String(e.id)}>
            <span className="flex items-center gap-2">
              <SportIcon sport={e.sport} size={14} className="text-muted-foreground" />
              {formatEventTitle(e)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ManualSettleDialog({
  bet,
  onSettle,
}: {
  bet: BetRow;
  onSettle: (status: SettledBetStatus, profit: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [profit, setProfit] = useState(0);

  const settleable = {
    market: bet.market as "other",
    selection: bet.selection,
    betType: (bet.betType as "qualifying") ?? "qualifying",
    backStake: bet.backStake,
    backOdds: bet.backOdds,
    layStake: bet.layStake,
    layOdds: bet.layOdds,
    commission: bet.commission,
    refundAmount: bet.refundAmount ?? undefined,
    refundRetention: bet.refundRetention ?? undefined,
  };

  function apply(kind: SettledBetStatus) {
    if (kind === "won" || kind === "lost" || kind === "early_payout") {
      onSettle(kind, profit);
    } else {
      const outcome = settlePartialOutcome(settleable, kind);
      onSettle(outcome.status, Number(outcome.profit.toFixed(2)));
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]">
          Settle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settle manually</DialogTitle>
          <DialogDescription>
            Full win/lose: enter net P&amp;L. Half / push / void: profit is calculated for you
            (Ultimatcher-style).
          </DialogDescription>
        </DialogHeader>
        <NumField label="Net profit (for won / lost)" prefix="£" value={profit} onChange={setProfit} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => apply("lost")}>
            Lost
          </Button>
          <Button onClick={() => apply("won")}>Won</Button>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="secondary" size="sm" onClick={() => apply("half_win")}>
            ½ win
          </Button>
          <Button variant="secondary" size="sm" onClick={() => apply("half_lose")}>
            ½ lose
          </Button>
          <Button variant="secondary" size="sm" onClick={() => apply("push")}>
            Push
          </Button>
          <Button variant="ghost" size="sm" onClick={() => apply("void")}>
            Void
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
