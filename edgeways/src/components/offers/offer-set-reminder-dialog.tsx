"use client";

/**
 * Set a free-text reminder on a sports offer campaign - typical use is a free
 * bet credited later, or a qualifier before the promo window closes. Defaults
 * to tomorrow at 12:00. Same control weight as casino Set reminder; the card
 * footer wraps when the action row is tight.
 */

import { useId, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DatePicker, formatYmdLocal } from "@/components/date-picker";
import { EventTimeInput } from "@/components/event-time-input";
import { api } from "@/hooks/use-app-state";
import { fromDatetimeLocalValue } from "@/lib/offers/offer-terms";
import { formatClockString } from "@/lib/time-format";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { UserReminderRow } from "@/lib/db/schema";

const DEFAULT_TIME = "12:00";

function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatYmdLocal(d);
}

function formatReminderWhen(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}, ${formatClockString(`${hh}:${mm}`)}`;
}

export function OfferSetReminderDialog({
  offer,
  onChanged,
}: {
  offer: OfferSummary;
  onChanged: (offer: OfferSummary) => void;
}) {
  const noteId = useId();
  const dateId = useId();
  const timeId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(tomorrowYmd);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [saving, setSaving] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setNote("");
      setDate(tomorrowYmd());
      setTime(DEFAULT_TIME);
    }
  }

  async function save() {
    const trimmed = note.trim();
    if (!trimmed) {
      toast.error("Add a short note for the reminder");
      return;
    }
    const remindAt = fromDatetimeLocalValue(`${date.trim()}T${time.trim() || DEFAULT_TIME}`);
    if (remindAt == null) {
      toast.error("Pick a valid date and time");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ reminder: UserReminderRow }>("/api/reminders", {
        method: "POST",
        json: {
          note: trimmed,
          remindAt,
          offerId: offer.id,
          contextTitle: offer.title,
          contextVenue: offer.bookmaker?.trim() || null,
        },
      });
      onChanged({
        ...offer,
        reminders: [...(offer.reminders ?? []), res.reminder].sort(
          (a, b) => a.remindAt - b.remindAt
        ),
      });
      setOpen(false);
      toast.success("Reminder set", {
        description: formatReminderWhen(res.reminder.remindAt),
      });
    } catch (e) {
      toast.error("Could not set reminder", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Controlled open (not DialogTrigger) so the Button stays on the Press path
          and matches sibling outline sm actions for height / face / press. */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Bell className="size-3.5" aria-hidden />
        Set reminder
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set a reminder</DialogTitle>
          <DialogDescription>
            Nudge when a free bet lands or a qualifier is due.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={noteId} className="text-xs font-normal text-muted-foreground">
              Note
            </Label>
            <textarea
              id={noteId}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Free bet credited - convert at Betfair"
              className={cn(
                fieldControl,
                "min-h-[4.5rem] w-full resize-y px-2.5 py-2 text-sm outline-none"
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={dateId} className="text-xs font-normal text-muted-foreground">
                Date
              </Label>
              <DatePicker
                id={dateId}
                value={date}
                onChange={setDate}
                placeholder="Pick a date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={timeId} className="text-xs font-normal text-muted-foreground">
                Time
              </Label>
              <EventTimeInput
                id={timeId}
                value={time}
                onChange={setTime}
                placeholder="12:00"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !note.trim()}>
            Set reminder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function OfferPendingReminders({
  offer,
  onChanged,
}: {
  offer: OfferSummary;
  onChanged: (offer: OfferSummary) => void;
}) {
  const pending = offer.reminders ?? [];
  if (pending.length === 0) return null;

  async function remove(id: number) {
    try {
      await api("/api/reminders", { method: "DELETE", json: { id } });
      onChanged({
        ...offer,
        reminders: (offer.reminders ?? []).filter((r) => r.id !== id),
      });
      toast.success("Reminder removed");
    } catch (e) {
      toast.error("Could not remove reminder", { description: String(e) });
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {pending.map((r) => (
        <div
          key={r.id}
          className="flex items-start gap-2.5 rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs"
        >
          <Bell
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              Reminder · {formatReminderWhen(r.remindAt)}
            </p>
            <p className="truncate text-muted-foreground">{r.note}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => void remove(r.id)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
