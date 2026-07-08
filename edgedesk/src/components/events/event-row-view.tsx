"use client";

import { useState } from "react";
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
import { parseRaceResults } from "@/lib/racing";
import { betRaceOutcome, type PromoAwardsByBetId } from "@/lib/bet-outcomes";
import { effectiveEventStatus, formatEventStatus, formatRacingEventTitle } from "@/lib/events";
import { FreeBetAwardBadge } from "@/components/free-bet-award-badge";
import { SportEventBlock } from "@/components/sport-icon";
import { formatPillLabel } from "@/lib/ui/status-badges";
import { Goal, Minus, Plus, Radio } from "lucide-react";

export function EventRowView({
  event,
  linkedBets,
  promoAwards,
  onPatch,
  onDelete,
}: {
  event: EventRow;
  linkedBets: BetRow[];
  promoAwards: PromoAwardsByBetId;
  onPatch: (id: number, json: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
}) {
  const isManual = event.source === "manual";
  const isRacing = event.sport === "horse_racing";
  const status = effectiveEventStatus(event);
  const live = status === "live";
  const raceResult = isRacing ? parseRaceResults(event.goals) : null;
  let goals: GoalEvent[] = [];
  if (!isRacing && event.goals) {
    try {
      goals = JSON.parse(event.goals) as GoalEvent[];
    } catch {
      goals = [];
    }
  }
  return (
    <TableRow>
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
                {event.source === "sim" && " · simulated"}
                {event.source === "api" && " · live feed"}
              </>
            )}
          </div>
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
            ) : event.status === "finished" ? (
              "—"
            ) : (
              "Awaiting result"
            )}
          </span>
        ) : (
          <div className="flex items-center justify-center gap-2">
            {isManual && event.status !== "finished" && (
              <ScoreStepper
                value={event.homeScore}
                onChange={(homeScore) => onPatch(event.id, { homeScore, status: "live" })}
              />
            )}
            <span className="min-w-12 text-center text-lg font-semibold tabular-nums">
              {event.homeScore}–{event.awayScore}
            </span>
            {isManual && event.status !== "finished" && (
              <ScoreStepper
                value={event.awayScore}
                onChange={(awayScore) => onPatch(event.id, { awayScore, status: "live" })}
              />
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {isRacing ? (
          "—"
        ) : (
          <>
            {event.homeLed2 ? "Home led by 2 " : ""}
            {event.awayLed2 ? "Away led by 2" : ""}
            {!event.homeLed2 && !event.awayLed2 && "—"}
          </>
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {isRacing && !raceResult && (
            <RacingWinnerDialog
              onRecord={(winner) => onPatch(event.id, { raceWinner: winner, status: "finished" })}
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
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => onDelete(event.id)}>
            Remove
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RacingWinnerDialog({ onRecord }: { onRecord: (winner: string) => void }) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          Set winner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Race result</DialogTitle>
          <DialogDescription>Enter the winning horse to settle linked Winner bets.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>Winner</Label>
          <Input
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            placeholder="e.g. Constitution Hill"
          />
        </div>
        <Button
          className="mt-2"
          disabled={!winner.trim()}
          onClick={() => {
            onRecord(winner.trim());
            setOpen(false);
            setWinner("");
          }}
        >
          Save result
        </Button>
      </DialogContent>
    </Dialog>
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
            Naming the scorer lets &quot;wins IF&quot; goalscorer triggers settle automatically.
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
