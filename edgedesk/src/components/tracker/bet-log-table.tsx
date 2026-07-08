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
import type { OfferSummary } from "@/lib/services/offers";
import { formatEventStatus, formatEventTitle } from "@/lib/events";
import { SportEventBlock, SportIcon } from "@/components/sport-icon";
import { previewAiTriggers } from "@/lib/calc";
import { betRaceOutcome, type PromoAwardsByBetId } from "@/lib/bet-outcomes";
import { parseRaceResults } from "@/lib/racing";
import {
  formatBetSelection,
  inferSportFromBet,
  isAutoSettleMarket,
  MARKET_LABELS,
} from "@/lib/markets";
import { formatGbp } from "@/lib/format-money";
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

              <TableCell className={cn(tableBodyCell, "whitespace-normal align-top text-right text-xs tabular-nums")}>
                {bet.backStake > 0 ? (
                  <div>{formatGbp(bet.backStake)} @ {bet.backOdds.toFixed(2)}</div>
                ) : (
                  <div className="text-muted-foreground">—</div>
                )}
                {bet.layStake > 0 ? (
                  <div className="mt-0.5 text-muted-foreground">
                    {formatGbp(bet.layStake)} @ {bet.layOdds.toFixed(2)}
                  </div>
                ) : null}
              </TableCell>

              <TableCell className={cn(tableBodyCell, "whitespace-normal align-top")}>
                <Badge variant={betStatusBadgeVariant(bet.status)} className="text-[10px]">
                  {bet.status === "early_payout" ? "2UP paid" : formatPillLabel(bet.status)}
                </Badge>
                <div className="mt-1.5 font-medium tabular-nums">
                  {bet.actualProfit != null ? (
                    <MoneyFlow value={bet.actualProfit} signColor signDisplay className="text-sm" />
                  ) : bet.expectedProfit != null ? (
                    <span className="text-xs text-muted-foreground">
                      exp. {formatGbp(bet.expectedProfit)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
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
                        onSettle={(profit, won) =>
                          onPatch(
                            bet.id,
                            { status: won ? "won" : "lost", actualProfit: profit },
                            "Bet settled"
                          )
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

function ManualSettleDialog({ onSettle }: { onSettle: (profit: number, won: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [profit, setProfit] = useState(0);
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
            For markets the result engine can&apos;t derive — enter the net profit or loss.
          </DialogDescription>
        </DialogHeader>
        <NumField label="Net profit (negative for a loss)" prefix="£" value={profit} onChange={setProfit} />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onSettle(profit, false);
              setOpen(false);
            }}
          >
            Mark lost
          </Button>
          <Button
            onClick={() => {
              onSettle(profit, true);
              setOpen(false);
            }}
          >
            Mark won
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
