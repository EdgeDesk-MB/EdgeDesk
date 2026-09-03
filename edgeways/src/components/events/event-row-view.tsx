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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import type { GoalEvent } from "@/lib/calc";
import type { BetRow, EventRow } from "@/lib/db/schema";
import {
  parseRaceResults,
  isRaceResultIncomplete,
} from "@/lib/racing";
import { betRaceOutcome, type PromoAwardsByBetId } from "@/lib/bet-outcomes";
import {
  effectiveEventStatus,
  eventShowsScore,
  formatEventStatus,
  formatRacingEventTitle,
} from "@/lib/events";
import { formatClockTime } from "@/lib/time-format";
import { FreeBetAwardBadge } from "@/components/free-bet-award-badge";
import { SportEventBlock } from "@/components/sport-icon";
import { formatPillLabel } from "@/lib/ui/status-badges";
import { useNow } from "@/hooks/use-now";
import {
  placingsTriggerLabel,
  RacingPlacingsDialog,
  resultActionButtonClass,
} from "@/components/racing/racing-placings-dialog";
import { cn } from "@/lib/utils";
import {
  Goal,
  Minus,
  Pencil,
  Plus,
  Radio,
  Trash2,
  TriangleAlert,
} from "lucide-react";

export function EventRowView({
  event,
  linkedBets,
  promoAwards,
  liveModel,
  onPatch,
  onDelete,
  resultDialogOpen,
  onResultDialogOpenChange,
}: {
  event: EventRow;
  linkedBets: BetRow[];
  promoAwards: PromoAwardsByBetId;
  /** Dixon-Coles live 1X2 when in play */
  liveModel?: { marketsLabel: string } | null;
  onPatch: (id: number, json: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  resultDialogOpen?: boolean;
  onResultDialogOpenChange?: (open: boolean) => void;
}) {
  const isManual = event.source === "manual";
  const isRacing = event.sport === "horse_racing";
  const status = effectiveEventStatus(event);
  const live = status === "live";
  const now = useNow(60_000);
  const raceResult = isRacing ? parseRaceResults(event.goals) : null;
  const betCount = linkedBets.length;
  const openBetCount = linkedBets.filter((b) => b.status === "open").length;
  const betsHref =
    betCount === 1
      ? `/tracker?highlight=${linkedBets[0]!.id}&queue=all`
      : `/tracker?event=${event.id}&queue=all`;
  let goals: GoalEvent[] = [];
  if (!isRacing && event.goals) {
    try {
      goals = JSON.parse(event.goals) as GoalEvent[];
    } catch {
      goals = [];
    }
  }
  return (
    <TableRow
      id={`tracked-event-${event.id}`}
      data-state={resultDialogOpen ? "selected" : undefined}
    >
      <TableCell>
        <SportEventBlock
          sport={event.sport}
          title={isRacing ? formatRacingEventTitle(event) : `${event.homeTeam} v ${event.awayTeam}`}
        >
          <div className="mt-0.5 text-xs text-muted-foreground">
            {isRacing ? (
              formatEventStatus(event, raceResult)
            ) : (
              <>
                {event.competition ?? event.sport}
                {event.startTime ? (
                  <>
                    {" · "}
                    <span className="tabular-nums">{formatClockTime(event.startTime)}</span>
                  </>
                ) : null}
                {event.source === "sim" && " · simulated"}
                {event.source === "api" && " · live feed"}
                {live && liveModel?.marketsLabel ? (
                  <span className="mt-0.5 block tabular-nums text-foreground/80">
                    Model · {liveModel.marketsLabel}
                  </span>
                ) : null}
              </>
            )}
          </div>
          {betCount > 0 ? (
            <Link
              href={betsHref}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-text underline-offset-2 hover:underline"
            >
              <span>
                {betCount === 1 ? "1 bet" : `${betCount} bets`}
                {openBetCount > 0 ? ` · ${openBetCount} open` : null}
              </span>
            </Link>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No bets</p>
          )}
          {isRacing &&
            linkedBets.map((bet) => {
              const outcome = betRaceOutcome(bet, event, promoAwards);
              if (!outcome?.positionLabel) return null;
              return (
                <div
                  key={bet.id}
                  className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{bet.selection}</span>
                  <span>·</span>
                  <span>{outcome.positionLabel}</span>
                  {outcome.promoAward && (
                    <FreeBetAwardBadge
                      amount={outcome.promoAward.amount}
                      reason={outcome.promoAward.reason}
                      compact
                    />
                  )}
                </div>
              );
            })}
          {goals.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {goals.map((g, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                  <Goal className="size-3" />
                  {g.player ?? (g.side === "home" ? event.homeTeam : event.awayTeam)} {g.minute}&apos;
                  {g.og ? " (og)" : ""}
                </span>
              ))}
            </div>
          )}
        </SportEventBlock>
      </TableCell>
      <TableCell>
        {isRacing ? (
          live ? (
            <Badge variant="active" className="gap-1">
              <Radio className="size-3 animate-pulse" /> Off
            </Badge>
          ) : (
            <Badge variant={status === "finished" ? "secondary" : "outline"}>
              {formatPillLabel(status)}
            </Badge>
          )
        ) : live ? (
          <Badge variant="active" className="gap-1">
            <Radio className="size-3 animate-pulse" /> {event.minute}&apos;
          </Badge>
        ) : (
          <Badge variant={status === "finished" ? "secondary" : "outline"}>
            {formatPillLabel(status)}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {isRacing ? (
          <span className="text-sm text-muted-foreground">
            {raceResult ? (
              <>Won by {raceResult.winner}</>
            ) : event.startTime > now ? (
              "-"
            ) : event.status === "finished" ? (
              "-"
            ) : (
              "Awaiting result"
            )}
          </span>
        ) : eventShowsScore(event) || isManual ? (
          <div>
            <div className="flex items-center gap-2">
              {isManual && event.status !== "finished" && (
                <ScoreStepper
                  value={event.homeScore}
                  onChange={(homeScore) => onPatch(event.id, { homeScore, status: "live" })}
                />
              )}
              <span className="text-lg font-semibold tabular-nums">
                {event.homeScore}–{event.awayScore}
              </span>
              {isManual && event.status !== "finished" && (
                <ScoreStepper
                  value={event.awayScore}
                  onChange={(awayScore) => onPatch(event.id, { awayScore, status: "live" })}
                />
              )}
            </div>
            {!!(event.homeLed2 || event.awayLed2) && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {event.homeLed2 ? "Home led by 2" : "Away led by 2"}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">–</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {isRacing && (
            <RacingPlacingsDialog
              event={event}
              linkedBets={linkedBets}
              incomplete={!!raceResult && isRaceResultIncomplete(raceResult)}
              open={resultDialogOpen}
              onOpenChange={onResultDialogOpenChange}
              onRecord={(payload) =>
                onPatch(event.id, {
                  raceWinner: payload.winner,
                  raceRunners: payload.runners,
                  status: "finished",
                })
              }
              trigger={
                raceResult && !isRaceResultIncomplete(raceResult) ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label="Edit result"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("text-xs", resultActionButtonClass)}
                  >
                    {placingsTriggerLabel(
                      event,
                      !!raceResult && isRaceResultIncomplete(raceResult)
                    )}
                  </Button>
                )
              }
            />
          )}
          {!isRacing && isManual && event.status !== "finished" && (
            <GoalDialog event={event} onRecord={(goal) => onPatch(event.id, { addGoal: goal })} />
          )}
          {!isRacing && status !== "finished" && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onPatch(event.id, { status: "finished" })}
            >
              Full time
            </Button>
          )}
          {!isRacing && status === "finished" && (
            <CorrectResultDialog event={event} onCorrect={(payload) => onPatch(event.id, { correctResult: payload })} />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(event.id)}
            aria-label="Stop tracking"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function GoalDialog({
  event,
  onRecord,
}: {
  event: EventRow;
  onRecord: (goal: { side: "home" | "away"; player?: string; og?: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"home" | "away">("home");
  const [player, setPlayer] = useState("");
  const [og, setOg] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <Goal className="size-3" /> Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record a goal</DialogTitle>
          <DialogDescription>
            Name the scorer so goalscorer bets settle.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Scored by</Label>
            <Select value={side} onValueChange={(v) => setSide(v as "home" | "away")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="home">{event.homeTeam}</SelectItem>
                <SelectItem value="away">{event.awayTeam}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Scorer (optional)</Label>
            <Input
              placeholder='e.g. "Harry Kane"'
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm">Own goal</span>
            <Switch checked={og} onCheckedChange={setOg} />
          </div>
          <Button
            onClick={() => {
              onRecord({ side, player: player.trim() || undefined, og: og || undefined });
              setPlayer("");
              setOg(false);
              setOpen(false);
            }}
          >
            Record goal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CorrectResultDialog({
  event,
  onCorrect,
}: {
  event: EventRow;
  onCorrect: (payload: {
    ftHomeScore: number;
    ftAwayScore: number;
    matchEnding: "ft" | "aet" | "pen";
    finalHomeScore: number;
    finalAwayScore: number;
    homeLed2?: boolean;
    awayLed2?: boolean;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [matchEnding, setMatchEnding] = useState<"ft" | "aet" | "pen">(
    (event.matchEnding as "ft" | "aet" | "pen" | null) ?? "aet"
  );
  const [finalHome, setFinalHome] = useState(event.homeScore);
  const [finalAway, setFinalAway] = useState(event.awayScore);
  const [ftHome, setFtHome] = useState(
    event.ftHomeScore ?? event.homeScore
  );
  const [ftAway, setFtAway] = useState(
    event.ftAwayScore ?? event.awayScore
  );
  const [homeLed2, setHomeLed2] = useState(!!event.homeLed2);
  const [awayLed2, setAwayLed2] = useState(!!event.awayLed2);

  const needsFtScore = matchEnding === "aet" || matchEnding === "pen";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
          <TriangleAlert className="size-3" /> Correct
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Correct result</DialogTitle>
          <DialogDescription>
            Update the score. Settled bets re-settle.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">How did the match end?</Label>
            <Select value={matchEnding} onValueChange={(v) => setMatchEnding(v as typeof matchEnding)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ft">Full time (90 min)</SelectItem>
                <SelectItem value="aet">After extra time (AET)</SelectItem>
                <SelectItem value="pen">Penalty shootout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Final score{needsFtScore ? " (after extra time)" : ""}
            </Label>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-right text-sm font-medium">{event.homeTeam}</span>
              <Input
                type="number"
                min={0}
                className="w-14 text-center"
                value={finalHome}
                onChange={(e) => setFinalHome(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                className="w-14 text-center"
                value={finalAway}
                onChange={(e) => setFinalAway(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <span className="min-w-0 flex-1 text-sm font-medium">{event.awayTeam}</span>
            </div>
          </div>

          {needsFtScore && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                90-minute score (bets settle here)
              </Label>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-right text-sm font-medium">{event.homeTeam}</span>
                <Input
                  type="number"
                  min={0}
                  className="w-14 text-center"
                  value={ftHome}
                  onChange={(e) => setFtHome(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  className="w-14 text-center"
                  value={ftAway}
                  onChange={(e) => setFtAway(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <span className="min-w-0 flex-1 text-sm font-medium">{event.awayTeam}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">2UP flags (did a team lead by 2+ goals in 90 min?)</Label>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{event.homeTeam} went 2 ahead</span>
              <Switch checked={homeLed2} onCheckedChange={setHomeLed2} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm">{event.awayTeam} went 2 ahead</span>
              <Switch checked={awayLed2} onCheckedChange={setAwayLed2} />
            </div>
          </div>

          <Button
            onClick={() => {
              onCorrect({
                // Full time: the final IS the 90-minute score
                ftHomeScore: needsFtScore ? ftHome : finalHome,
                ftAwayScore: needsFtScore ? ftAway : finalAway,
                matchEnding,
                finalHomeScore: finalHome,
                finalAwayScore: finalAway,
                homeLed2,
                awayLed2,
              });
              setOpen(false);
            }}
          >
            Apply correction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Button variant="outline" size="icon" className="size-5" onClick={() => onChange(value + 1)}>
        <Plus className="size-3" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-5"
        disabled={value === 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <Minus className="size-3" />
      </Button>
    </div>
  );
}
