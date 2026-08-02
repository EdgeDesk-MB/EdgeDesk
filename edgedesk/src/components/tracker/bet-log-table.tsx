"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/date-picker";
import { TimePicker } from "@/components/time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MoneyFlow, moneyPositiveClass } from "@/components/money-flow";
import { FreeBetAwardBadge } from "@/components/free-bet-award-badge";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import {
  formatEventStatus,
  formatEventTitle,
  localCalendarDate,
  londonWallToUtcMs,
} from "@/lib/events";
import {
  bandLinkableEventsForPicker,
  formatTrackedEventOption,
} from "@/lib/add-bet-event-options";
import { SportEventBlock, SportIcon } from "@/components/sport-icon";
import {
  previewAiTriggers,
  settleFromOutcome,
  settlePartialOutcome,
  type SettledBetStatus,
} from "@/lib/calc";
import { betRaceOutcome, type PromoAwardsByBetId } from "@/lib/bet-outcomes";
import { LockInDialog, canLockIn } from "@/components/tracker/lock-in-dialog";
import {
  placingsTriggerLabel,
  RacingPlacingsDialog,
  resultActionButtonClass,
} from "@/components/racing/racing-placings-dialog";
import { isRaceResultIncomplete, parseRaceResults } from "@/lib/racing";
import {
  formatBetSelection,
  inferSportFromBet,
  isAutoSettleMarket,
  linkableEventsForSport,
  MARKET_LABELS,
} from "@/lib/markets";
import { formatGbp } from "@/lib/format-money";
import { sportDisplayLabel } from "@/lib/sports";
import {
  isBetCancelled,
  isOfferExpired,
  offerInactiveFigureClass,
} from "@/lib/offers/offer-inactive-ui";
import { tableBodyCell, tableHeaderCell } from "@/lib/ui/surface-styles";
import { betStatusBadgeVariant, formatPillLabel } from "@/lib/ui/status-badges";
import { cn } from "@/lib/utils";
import { api } from "@/hooks/use-app-state";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import { Link2, Pencil, RotateCcw, Sparkles } from "lucide-react";

const stickyActionsHead =
  "sticky right-0 z-20 w-14 border-l border-border/60 bg-card px-1 shadow-[-6px_0_10px_-6px_color-mix(in_oklch,var(--border)_50%,transparent)]";

const stickyActionsCell =
  "sticky right-0 z-10 w-14 border-l border-border/60 bg-card px-1 shadow-[-6px_0_10px_-6px_color-mix(in_oklch,var(--border)_50%,transparent)]";

export function BetLogTable({
  bets,
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
  bets: BetRow[];
  events: EventRow[];
  promoAwards: PromoAwardsByBetId;
  offerById: Map<number, OfferSummary>;
  eventById: Map<number, EventRow>;
  highlightId: number | null;
  onEdit: (bet: BetRow) => void;
  onPatch: (id: number, json: Record<string, unknown>, message: string) => void;
  /** Record race placings on a linked event (settles derived markets). */
  onPatchEvent: (id: number, json: Record<string, unknown>, message: string) => void;
  /** Called after a lock-in trade is logged so the parent refreshes */
  onLogged: () => void;
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
    <>
      {/* Mobile: card list (C2 progressive disclosure - tables become cards < sm) */}
      <div className="sm:hidden">
        {bets.map((bet) => {
          const event = bet.eventId ? eventById.get(bet.eventId) : undefined;
          const raceOutcome = betRaceOutcome(bet, event, promoAwards);
          const offer = bet.offerId != null ? offerById.get(bet.offerId) : undefined;
          const inactiveFigure = offerInactiveFigureClass(
            isBetCancelled(bet) || (offer != null && isOfferExpired(offer))
          );
          const sport = inferSportFromBet(bet.market, event?.sport);
          const canSetRaceResult =
            bet.status === "open" && event?.sport === "horse_racing";
          // Free-bet trigger rules alone must not hide Set result — only hide when
          // a result-centric path exists (race placings, or linked auto-settle market).
          const canManualSettle =
            bet.status === "open" &&
            !canSetRaceResult &&
            (!event || !isAutoSettleMarket(sport, bet.market));
          const raceResult = event ? parseRaceResults(event.goals) : null;
          const raceIncomplete =
            !!raceResult && isRaceResultIncomplete(raceResult);
          const linkedRaceBets = event
            ? bets.filter((b) => b.eventId === event.id)
            : [];

          return (
            <div
              key={bet.id}
              id={`bet-card-${bet.id}`}
              className={cn(
                "border-b border-border/60 px-[var(--layout-page-x)] py-3",
                highlightId === bet.id && "bet-row-highlight"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{bet.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
                  </p>
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
                  <Badge variant={betStatusBadgeVariant(bet.status)} className="text-[10px]">
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
                <p className={cn("text-xs tabular-nums text-muted-foreground", inactiveFigure)}>
                  {bet.backStake > 0
                    ? `${formatGbp(bet.backStake)} @ ${bet.backOdds.toFixed(2)}`
                    : "-"}
                  {bet.layStake > 0
                    ? ` · lay ${formatGbp(bet.layStake)} @ ${bet.layOdds.toFixed(2)}`
                    : ""}
                </p>
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
    <Table className="min-w-[720px] table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(tableHeaderCell, "w-[26%]")}>Bet</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[20%]")}>Event</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[14%]")}>Market</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[14%] text-right")}>Stakes</TableHead>
          <TableHead className={cn(tableHeaderCell, "w-[14%]")}>Result</TableHead>
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
          const sport = inferSportFromBet(bet.market, event?.sport);
          const canSetRaceResult =
            bet.status === "open" && event?.sport === "horse_racing";
          // Free-bet trigger rules alone must not hide Set result — only hide when
          // a result-centric path exists (race placings, or linked auto-settle market).
          const canManualSettle =
            bet.status === "open" &&
            !canSetRaceResult &&
            (!event || !isAutoSettleMarket(sport, bet.market));
          const raceResult = event ? parseRaceResults(event.goals) : null;
          const raceIncomplete =
            !!raceResult && isRaceResultIncomplete(raceResult);
          const linkedRaceBets = event
            ? bets.filter((b) => b.eventId === event.id)
            : [];

          return (
            <TableRow
              key={bet.id}
              id={`bet-row-${bet.id}`}
              className={cn(
                "hover:bg-transparent",
                highlightId === bet.id && "bet-row-highlight"
              )}
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
                    sport={inferSportFromBet(bet.market, null, offer?.sport)}
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
                            "h-7 px-2 text-[10px]",
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

function yesterdayCalendarDate(now = Date.now()): string {
  const today = localCalendarDate(new Date(now));
  const noon = londonWallToUtcMs(today, "12:00") ?? now;
  return localCalendarDate(new Date(noon - 86_400_000));
}

function LinkEventSelect({
  events,
  bet,
  sport,
  onLink,
}: {
  events: EventRow[];
  bet: BetRow;
  /** Sport used when the bet was placed (offer sport, else market inference). */
  sport: string;
  onLink: (eventId: number, market: string, selection: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [addingRace, setAddingRace] = useState(false);
  const [course, setCourse] = useState("");
  const [raceDate, setRaceDate] = useState(() => yesterdayCalendarDate());
  const [raceTime, setRaceTime] = useState("");
  const [busy, setBusy] = useState(false);

  const isRacing = sport === "horse_racing";
  const dayBands = useMemo(() => {
    const linkable = linkableEventsForSport(events, sport);
    return bandLinkableEventsForPicker(linkable);
  }, [events, sport]);
  const eventCount = dayBands.reduce((n, b) => n + b.items.length, 0);
  const sportLabel = sportDisplayLabel(sport).toLowerCase();

  if (eventCount === 0 && !isRacing) {
    return (
      <span className="text-xs text-muted-foreground">No {sportLabel} events</span>
    );
  }

  async function createAndLinkRace() {
    const trimmed = course.trim();
    const startTime = londonWallToUtcMs(raceDate, raceTime.trim());
    if (!trimmed) {
      toast.error("Enter the course");
      return;
    }
    if (startTime == null) {
      toast.error("Enter a valid date and off time");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ event: { id: number } }>("/api/events/track-racing", {
        method: "POST",
        json: { course: trimmed, startTime },
      });
      onLink(res.event.id, bet.market, bet.selection);
      setOpen(false);
      setAddingRace(false);
      setCourse("");
      setRaceTime("");
      toast.success("Race linked", {
        description: "Set result (1st–4th) if placings are still needed.",
      });
    } catch (e) {
      toast.error("Could not add race", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAddingRace(false);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full max-w-[10rem] justify-start px-2 text-xs text-muted-foreground"
        >
          <Link2 className="size-3 shrink-0" /> Link event
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-sm gap-0 p-0"
        onFocusOutside={preventDialogDismissOnPortaledContent}
        onPointerDownOutside={preventDialogDismissOnPortaledContent}
        onInteractOutside={preventDialogDismissOnPortaledContent}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>Link event</DialogTitle>
          <DialogDescription>
            {isRacing
              ? "Search tracked races, or add a past meeting that was never tracked."
              : `Search tracked ${sportLabel} events, including past results on file.`}
          </DialogDescription>
        </DialogHeader>
        {eventCount > 0 ? (
          <Command
            className={cn(
              "border-t",
              "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
              "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold",
              "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide",
              "[&_[cmdk-group-heading]]:text-muted-foreground"
            )}
          >
            <CommandInput placeholder={`Search ${sportLabel}…`} />
            <CommandList className="max-h-64">
              <CommandEmpty>No matching event.</CommandEmpty>
              {dayBands.map((band) => (
                <CommandGroup key={band.key} heading={band.label}>
                  {band.items.map((e) => {
                    const label = formatTrackedEventOption(e);
                    return (
                      <CommandItem
                        key={e.id}
                        value={`${label} ${band.label} ${e.homeTeam} ${e.awayTeam} ${e.competition ?? ""}`}
                        onSelect={() => {
                          onLink(e.id, bet.market, bet.selection);
                          setOpen(false);
                        }}
                      >
                        <SportIcon sport={e.sport} size={14} className="text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        ) : null}
        {isRacing ? (
          <div className="border-t px-4 py-3">
            {addingRace ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] text-muted-foreground">
                  Free racecards only cover today and tomorrow. Add yesterday&apos;s race by
                  course and off time, then set placings.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Course</Label>
                  <Input
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g. Thirsk"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <DatePicker value={raceDate} onChange={setRaceDate} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">Off time</Label>
                    <TimePicker value={raceTime} onChange={setRaceTime} placeholder="12:00" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => setAddingRace(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={() => void createAndLinkRace()}
                  >
                    {busy ? "Linking…" : "Add & link"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAddingRace(true)}
              >
                Race not listed? Add course &amp; time
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
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
      <span className={cn("font-medium", profitEntryClass(value))}>{formatGbp(value)}</span>
    </span>
  );
}

/** Acca / bet-status chip style for Won / Lost selectors (green/red hover + focus). */
function settleOutcomeButtonClass(kind: "won" | "lost", active: boolean): string {
  if (kind === "won") {
    return cn(
      "focus-visible:border-success/50 focus-visible:ring-success/30",
      active
        ? "border-success/40 bg-success/15 text-success hover:bg-success/25 hover:text-success"
        : "border-border bg-background text-muted-foreground hover:border-success/40 hover:bg-success/10 hover:text-success"
    );
  }
  return cn(
    "focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
    active
      ? "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25 hover:text-destructive"
      : "border-border bg-background text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
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
  const [fullResult, setFullResult] = useState<"won" | "lost" | null>(null);

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

  const knownWinProfit = Number(settleFromOutcome(settleable, true).profit.toFixed(2));
  const knownLoseProfit = Number(settleFromOutcome(settleable, false).profit.toFixed(2));

  function resetDialog() {
    setProfit(0);
    setFullResult(null);
  }

  function selectFull(kind: "won" | "lost") {
    setFullResult(kind);
    setProfit(kind === "won" ? knownWinProfit : knownLoseProfit);
  }

  function settleFull() {
    if (!fullResult) return;
    onSettle(fullResult, Number((Number.isFinite(profit) ? profit : 0).toFixed(2)));
    setOpen(false);
    resetDialog();
  }

  function applyPartial(kind: "half_win" | "half_lose" | "push" | "void") {
    const outcome = settlePartialOutcome(settleable, kind);
    onSettle(outcome.status, Number(outcome.profit.toFixed(2)));
    setOpen(false);
    resetDialog();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 px-2 text-[10px] max-sm:h-9 max-sm:px-3 max-sm:text-xs",
            resultActionButtonClass
          )}
        >
          Set result
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Set result</DialogTitle>
          <DialogDescription>
            Pick won or lost to fill expected P&amp;L, then settle. Half, push and void calculate for you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className={settleOutcomeButtonClass("won", fullResult === "won")}
            onClick={() => selectFull("won")}
          >
            Won
          </Button>
          <Button
            variant="outline"
            className={settleOutcomeButtonClass("lost", fullResult === "lost")}
            onClick={() => selectFull("lost")}
          >
            Lost
          </Button>
        </div>
        <NumField
          label="Net profit (for won / lost)"
          prefix="£"
          value={profit}
          onChange={setProfit}
          prefixClassName="text-base"
          inputClassName={cn(
            "h-11 pl-8 text-lg font-semibold md:text-lg",
            profitEntryClass(profit)
          )}
        />
        <Button className="w-full" disabled={!fullResult} onClick={settleFull}>
          Settle
        </Button>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => applyPartial("void")}
          >
            Void
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPartial("half_win")}>
            ½ win
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPartial("half_lose")}>
            ½ lose
          </Button>
          <Button variant="secondary" size="sm" onClick={() => applyPartial("push")}>
            Push
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
