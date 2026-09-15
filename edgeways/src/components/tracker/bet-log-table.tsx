"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TwoUpStakesHint } from "@/components/bets/two-up-stakes-hint";
import { MoneyFlow, moneyPositiveClass } from "@/components/money-flow";
import { FreeBetAwardBadge } from "@/components/free-bet-award-badge";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import { formatEventStatus, formatEventTitle } from "@/lib/events";
import { SportEventBlock } from "@/components/sport-icon";
import { previewAiTriggers } from "@/lib/calc";
import { betRaceOutcome, type PromoAwardsByBetId } from "@/lib/bet-outcomes";
import { canManualSettleBet } from "@/lib/bets/manual-settle";
import {
  LinkEventSelect,
  LinkOfferSelect,
  linkableOffers as linkableOffersFrom,
} from "@/components/tracker/bet-link-controls";
import { LockInDialog, canLockIn } from "@/components/tracker/lock-in-dialog";
import { ManualSettleDialog } from "@/components/tracker/manual-settle-dialog";
import {
  placingsTriggerLabel,
  RacingPlacingsDialog,
  resultActionButtonClass,
} from "@/components/racing/racing-placings-dialog";
import { isRaceResultIncomplete, parseRaceResults } from "@/lib/racing";
import {
  formatBetSelection,
  inferSportFromBet,
  isKnownSport,
  MARKET_LABELS,
} from "@/lib/markets";
import { useBookieScopes } from "@/hooks/use-bookie-scopes";
import { earlyPayoutOfferLabel } from "@/lib/twoup/desk-view";
import type { EpBookieSetup } from "@/lib/twoup/bookie-offers";
import { formatEvGbp, formatGbp } from "@/lib/format-money";
import {
  isBetCancelled,
  isOfferExpired,
  offerInactiveFigureClass,
} from "@/lib/offers/offer-inactive-ui";
import {
  deskTableBodyCell,
  deskTableHeaderCell,
  listRowGroup,
  tableEdgeStart,
} from "@/lib/ui/surface-styles";
import { betStatusBadgeVariant, formatPillLabel } from "@/lib/ui/status-badges";
import { cn } from "@/lib/utils";
import { formatAccaDeskBetDisplayTitle, isAccaDeskBack, isAccaDeskLay } from "@/lib/bets/acca-desk-bets";
import { betLogTypeCaption } from "@/lib/bets/bet-log-title";
import { repairCollapsedFootballFixtureLabel } from "@/lib/bets/football-bet-label";
import { stripStaleHorseFromRacingBetLabel } from "@/lib/bets/racing-bet-label";
import { Pencil, RotateCcw, Zap } from "lucide-react";

function betLogTitle(bet: BetRow, event?: EventRow | null): string {
  if (isAccaDeskBack(bet) || isAccaDeskLay(bet)) return formatAccaDeskBetDisplayTitle(bet);
  const stripped = stripStaleHorseFromRacingBetLabel(bet.label, bet.selection);
  return repairCollapsedFootballFixtureLabel(stripped, event?.homeTeam, event?.awayTeam);
}

function BetLogTypeLine({
  bet,
  title,
  offer,
  bookieSetup,
  className,
}: {
  bet: BetRow;
  title: string;
  offer?: OfferSummary;
  bookieSetup?: EpBookieSetup | null;
  className?: string;
}) {
  const typeLabel = betLogTypeCaption(title, bet.betType);
  const sport =
    (bet.sport && isKnownSport(bet.sport) ? bet.sport : null) ??
    (offer?.sport && isKnownSport(offer.sport) ? offer.sport : null);
  const epLabel = bet.earlyPayout
    ? earlyPayoutOfferLabel(bet, sport, bookieSetup)
    : null;
  if (!typeLabel && !epLabel && !offer) return null;
  return (
    <div className={cn("mt-0.5 text-xs text-muted-foreground", className)}>
      {typeLabel}
      {typeLabel && epLabel ? ` · ${epLabel}` : epLabel ?? ""}
      {offer && (
        <>
          {typeLabel || bet.earlyPayout ? " · " : ""}
          <Link href="/offers" className="text-primary-text hover:underline">
            {offer.title.length > 28 ? `${offer.title.slice(0, 25)}…` : offer.title}
          </Link>
        </>
      )}
    </div>
  );
}

/**
 * Actions column: right inset matches Campaign P&L (pr-4). Not sticky — a
 * sticky opaque plate covers the <tr> border-b and stops the row rule short.
 */
const actionsHead = "w-14 py-2 pr-4 pl-2 text-right";
const actionsCell = "w-14 py-2.5 pr-4 pl-2 text-right align-top";

export function BetLogTable({
  bets,
  events,
  promoAwards,
  offerById,
  eventById,
  highlightId,
  labelledBy,
  onEdit,
  onPatch,
  onPatchEvent,
  onLogged,
}: {
  bets: BetRow[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  labelledBy?: string;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
  /** Record race placings on a linked event (settles derived markets). */
  onPatchEvent: (id: number, json: Record<string, unknown>, message: string) => void;
  /** Called after a lock-in trade is logged so the parent refreshes */
  onLogged: () => void;
}) {
  const { setup: bookieSetup } = useBookieScopes();
  const linkableOffers = linkableOffersFrom([...offerById.values()]);

  return (
    <>
      {/* Mobile: card list (C2 progressive disclosure - tables become cards < sm) */}
      <div
        className={cn("sm:hidden", listRowGroup)}
        {...(labelledBy ? { "aria-labelledby": labelledBy } : {})}
      >
        {bets.map((bet) => {
          const event = bet.eventId ? eventById.get(bet.eventId) : undefined;
          const raceOutcome = betRaceOutcome(bet, event, promoAwards);
          const offer = bet.offerId != null ? offerById.get(bet.offerId) : undefined;
          const inactiveFigure = offerInactiveFigureClass(
            isBetCancelled(bet) || (offer != null && isOfferExpired(offer))
          );
          const sport = inferSportFromBet(
            bet.market,
            event?.sport,
            offer?.sport,
            bet.sport
          );
          const canSetRaceResult =
            bet.status === "open" && event?.sport === "horse_racing";
          const canManualSettle = canManualSettleBet(bet, event, offer?.sport);
          const raceResult = event ? parseRaceResults(event.goals) : null;
          const raceIncomplete =
            !!raceResult && isRaceResultIncomplete(raceResult);
          const linkedRaceBets = event
            ? bets.filter((b) => b.eventId === event.id)
            : [];
          const title = betLogTitle(bet, event);

          return (
            <div
              key={bet.id}
              id={`bet-card-${bet.id}`}
              {...(canManualSettle
                ? {
                    tabIndex: 0,
                    "data-open-bet-row": bet.id,
                    "aria-label": `Open bet: ${title}. Press S to set the result.`,
                  }
                : {})}
              className={cn(
                "border-b border-border/60 px-[var(--layout-page-x)] py-3",
                canManualSettle &&
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-inset",
                highlightId === bet.id && "bet-row-highlight"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{title}</p>
                  <BetLogTypeLine
                    bet={bet}
                    title={title}
                    offer={offer}
                    bookieSetup={bookieSetup}
                  />
                  {bet.offerId == null && linkableOffers.length > 0 && (
                    <div className="mt-1.5">
                      <LinkOfferSelect
                        offers={linkableOffers}
                        onLink={(offerId) =>
                          onPatch(bet.id, { offerId }, "Linked to offer campaign")
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={betStatusBadgeVariant(bet.status)} className="text-[11px]">
                    {bet.status === "early_payout"
                      ? "2UP paid"
                      : bet.status === "half_win"
                        ? "½ win"
                        : bet.status === "half_lose"
                          ? "½ lose"
                          : formatPillLabel(bet.status)}
                  </Badge>
                  <div className="mt-1 font-medium tabular-nums">
                    {bet.actualProfit != null ? (
                      <MoneyFlow
                        value={bet.actualProfit}
                        signColor={!isBetCancelled(bet)}
                        signDisplay
                        className={cn("text-sm", inactiveFigure)}
                      />
                    ) : bet.expectedProfit != null ? (
                      <ExpectedProfitLabel
                        value={bet.expectedProfit}
                        className={inactiveFigure}
                      />
                    ) : null}
                  </div>
                  {canSetRaceResult && event && (
                    <div className="mt-1.5 flex justify-end">
                      <RacingPlacingsDialog
                        event={event}
                        linkedBets={linkedRaceBets}
                        incomplete={raceIncomplete}
                        onRecord={(payload) =>
                          onPatchEvent(
                            event.id,
                            {
                              raceWinner: payload.winner,
                              raceRunners: payload.runners,
                              status: "finished",
                            },
                            "Race result saved"
                          )
                        }
                        trigger={
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 px-3 text-xs",
                              resultActionButtonClass
                            )}
                          >
                            {placingsTriggerLabel(event, raceIncomplete)}
                          </Button>
                        }
                      />
                    </div>
                  )}
                  {canManualSettle && (
                    <div className="mt-1.5 flex justify-end">
                      <ManualSettleDialog
                        bet={bet}
                        onSettle={(status, profit) =>
                          onPatch(bet.id, { status, actualProfit: profit }, "Bet settled")
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
                {event ? formatEventTitle(event) : "No event linked"}
                {raceOutcome?.positionLabel ? ` · ${raceOutcome.positionLabel}` : ""}
                {" · "}
                {MARKET_LABELS[bet.market] ?? bet.market}
                {bet.selection
                  ? ` · ${formatBetSelection(bet.market, bet.selection, event?.homeTeam, event?.awayTeam)}`
                  : ""}
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className={cn("min-w-0 text-xs tabular-nums text-muted-foreground", inactiveFigure)}>
                  <p>
                    {bet.backStake > 0
                      ? `${formatGbp(bet.backStake)} @ ${bet.backOdds.toFixed(2)}`
                      : "-"}
                    {bet.layStake > 0
                      ? ` · lay ${formatGbp(bet.layStake)} @ ${bet.layOdds.toFixed(2)}`
                      : ""}
                  </p>
                  <TwoUpStakesHint bet={bet} className="mt-0.5" />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {canLockIn(bet) && <LockInDialog bet={bet} onLogged={onLogged} />}
                  {bet.status !== "open" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 shrink-0 text-muted-foreground"
                      onClick={() => onPatch(bet.id, { status: "open" }, "Bet reopened")}
                      aria-label="Reopen bet"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0"
                    onClick={() => onEdit(bet)}
                    aria-label="Edit bet"
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block">
    <Table
      className="min-w-[720px] table-fixed"
      aria-labelledby={labelledBy}
    >
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(deskTableHeaderCell, tableEdgeStart, "w-[26%]")}>
            Bet
          </TableHead>
          <TableHead className={cn(deskTableHeaderCell, "w-[20%]")}>Event</TableHead>
          <TableHead className={cn(deskTableHeaderCell, "w-[14%]")}>Market</TableHead>
          <TableHead className={cn(deskTableHeaderCell, "w-[14%] text-right")}>
            Stakes
          </TableHead>
          <TableHead className={cn(deskTableHeaderCell, "w-[14%]")}>Result</TableHead>
          <TableHead className={cn(deskTableHeaderCell, actionsHead)}>
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
          const sport = inferSportFromBet(
            bet.market,
            event?.sport,
            offer?.sport,
            bet.sport
          );
          const canSetRaceResult =
            bet.status === "open" && event?.sport === "horse_racing";
          const canManualSettle = canManualSettleBet(bet, event, offer?.sport);
          const raceResult = event ? parseRaceResults(event.goals) : null;
          const raceIncomplete =
            !!raceResult && isRaceResultIncomplete(raceResult);
          const linkedRaceBets = event
            ? bets.filter((b) => b.eventId === event.id)
            : [];
          const title = betLogTitle(bet, event);

          return (
            <TableRow
              key={bet.id}
              id={`bet-row-${bet.id}`}
              {...(canManualSettle
                ? {
                    tabIndex: 0,
                    "data-open-bet-row": bet.id,
                    "aria-label": `Open bet: ${title}. Press S to set the result.`,
                  }
                : {})}
              className={cn(
                "hover:bg-transparent",
                canManualSettle &&
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-inset",
                highlightId === bet.id && "bet-row-highlight"
              )}
            >
              <TableCell
                className={cn(
                  deskTableBodyCell,
                  tableEdgeStart,
                  "whitespace-normal align-top"
                )}
              >
                <div className="line-clamp-2 font-medium leading-snug">{title}</div>
                <BetLogTypeLine
                  bet={bet}
                  title={title}
                  offer={offer}
                  bookieSetup={bookieSetup}
                  className="line-clamp-1"
                />
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
                  <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                    <Zap className="mr-0.5 inline size-3 shrink-0 text-violet-500" />
                    {bet.triggerText || triggers[0]}
                  </div>
                )}
              </TableCell>

              <TableCell className={cn(deskTableBodyCell, "whitespace-normal align-top")}>
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
                    sport={inferSportFromBet(
                      bet.market,
                      null,
                      offer?.sport,
                      bet.sport
                    )}
                    onLink={(eventId, market, selection) =>
                      onPatch(bet.id, { eventId, market, selection }, "Linked to event")
                    }
                    bet={bet}
                  />
                )}
              </TableCell>

              <TableCell className={cn(deskTableBodyCell, "whitespace-normal align-top text-xs leading-snug")}>
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
                  deskTableBodyCell,
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
                <TwoUpStakesHint bet={bet} className="mt-0.5 justify-end" />
              </TableCell>

              <TableCell className={cn(deskTableBodyCell, "whitespace-normal align-top")}>
                <Badge variant={betStatusBadgeVariant(bet.status)} className="text-[11px]">
                  {bet.status === "early_payout"
                    ? "2UP paid"
                    : bet.status === "half_win"
                      ? "½ win"
                      : bet.status === "half_lose"
                        ? "½ lose"
                        : formatPillLabel(bet.status)}
                </Badge>
                <div className="mt-1.5 font-medium tabular-nums">
                  {bet.actualProfit != null ? (
                    <MoneyFlow
                      value={bet.actualProfit}
                      signColor={!isBetCancelled(bet)}
                      signDisplay
                      className={cn("text-sm", inactiveFigure)}
                    />
                  ) : bet.expectedProfit != null ? (
                    <ExpectedProfitLabel
                      value={bet.expectedProfit}
                      className={inactiveFigure}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
                {canSetRaceResult && event && (
                  <div className="mt-1.5">
                    <RacingPlacingsDialog
                      event={event}
                      linkedBets={linkedRaceBets}
                      incomplete={raceIncomplete}
                      onRecord={(payload) =>
                        onPatchEvent(
                          event.id,
                          {
                            raceWinner: payload.winner,
                            raceRunners: payload.runners,
                            status: "finished",
                          },
                          "Race result saved"
                        )
                      }
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-7 px-2 text-[11px]",
                            resultActionButtonClass
                          )}
                        >
                          {placingsTriggerLabel(event, raceIncomplete)}
                        </Button>
                      }
                    />
                  </div>
                )}
                {canManualSettle && (
                  <div className="mt-1.5">
                    <ManualSettleDialog
                      bet={bet}
                      onSettle={(status, profit) =>
                        onPatch(bet.id, { status, actualProfit: profit }, "Bet settled")
                      }
                    />
                  </div>
                )}
              </TableCell>

              <TableCell
                className={cn(
                  deskTableBodyCell,
                  actionsCell,
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
                  {canLockIn(bet) && <LockInDialog bet={bet} onLogged={onLogged} />}
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
      </div>
    </>
  );
}

/** MoneyFlow-aligned colour for P&L digits (not the £ prefix). */
function profitEntryClass(value: number): string {
  const rounded = Number((Number.isFinite(value) ? value : 0).toFixed(2));
  if (rounded === 0) return "text-muted-foreground";
  if (rounded > 0) return moneyPositiveClass;
  return "text-negative";
}

/** Expected P&L on the tracker row: whole amount coloured (incl. £). */
function ExpectedProfitLabel({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("text-xs tabular-nums text-muted-foreground", className)}>
      exp.{" "}
      <span className={cn("font-medium", profitEntryClass(value))}>{formatEvGbp(value)}</span>
    </span>
  );
}
