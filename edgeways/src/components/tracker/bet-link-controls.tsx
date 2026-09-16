"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
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
import { SportIcon } from "@/components/sport-icon";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { OfferSummary } from "@/lib/services/offers.types";
import { localCalendarDate, londonWallToUtcMs } from "@/lib/events";
import {
  bandLinkableEventsForPicker,
  formatTrackedEventOption,
} from "@/lib/add-bet-event-options";
import { linkableEventsForSport } from "@/lib/markets";
import { sportDisplayLabel } from "@/lib/sports";
import { api } from "@/hooks/use-app-state";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import { suppressRaceOffSoonForBetLink } from "@/lib/alerts/race-off-soon-suppress";
import { cn } from "@/lib/utils";

export function linkableOffers(offers: OfferSummary[]): OfferSummary[] {
  return [...offers]
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
}

export function LinkOfferSelect({
  offers,
  onLink,
}: {
  offers: OfferSummary[];
  onLink: (offerId: number) => void;
}) {
  return (
    <Select onValueChange={(v) => onLink(Number(v))}>
      <SelectTrigger size="sm" className="h-7 w-full max-w-[11rem] text-xs">
        <span className="flex items-center gap-1 text-primary-text">
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
              <span className="text-[11px] text-muted-foreground">
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

export function LinkEventSelect({
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

  function linkToEvent(eventId: number) {
    suppressRaceOffSoonForBetLink(eventId);
    onLink(eventId, bet.market, bet.selection);
  }

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
      suppressRaceOffSoonForBetLink(res.event.id);
      linkToEvent(res.event.id);
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
        <DialogHeader className="mx-0 mt-0">
          <DialogTitle>Link event</DialogTitle>
          <DialogDescription>
            {isRacing
              ? "Search tracked races, or add a past meeting."
              : `Search tracked ${sportLabel} events.`}
          </DialogDescription>
        </DialogHeader>
        {eventCount > 0 ? (
          <Command
            className={cn(
              "border-t",
              "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
              "[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold",
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
                          linkToEvent(e.id);
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
                <p className="text-xs text-muted-foreground">
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
                <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
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
