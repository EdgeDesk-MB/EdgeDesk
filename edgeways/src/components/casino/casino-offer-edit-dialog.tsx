"use client";

/** Edit a campaign's own fields (casino/title/notes) - separate from editing a component. */

import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { DatePicker } from "@/components/date-picker";
import { EventTimeInput } from "@/components/event-time-input";
import { VenueSelect } from "@/components/venue-select";
import { api } from "@/hooks/use-app-state";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/offers/offer-terms";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function splitDatetimeLocal(value: string): { date: string; time: string } {
  if (!value.trim()) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function expiresAtFromParts(date: string, time: string): number | null {
  if (!date.trim()) return null;
  const hhmm = time.trim() || "23:59";
  return fromDatetimeLocalValue(`${date.trim()}T${hhmm}`);
}

function bootExpiry(offer: CasinoOfferSummary): { date: string; time: string } {
  if (offer.expiresAt == null) return { date: "", time: "" };
  return splitDatetimeLocal(toDatetimeLocalValue(offer.expiresAt));
}

export function CasinoOfferEditDialog({
  offer,
  onSaved,
}: {
  offer: CasinoOfferSummary;
  onSaved: (offer: CasinoOfferSummary) => void;
}) {
  const initial = bootExpiry(offer);
  const [open, setOpen] = useState(false);
  const [casino, setCasino] = useState(offer.casino ?? "");
  const [title, setTitle] = useState(offer.title);
  const [notes, setNotes] = useState(offer.notes ?? "");
  const [expiresDate, setExpiresDate] = useState(initial.date);
  const [expiresTime, setExpiresTime] = useState(initial.time);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api<{ offer: CasinoOfferSummary }>(`/api/casino/${offer.id}`, {
        method: "PATCH",
        json: {
          casino: casino.trim() || null,
          title: title.trim(),
          notes: notes.trim() || null,
          expiresAt: expiresAtFromParts(expiresDate, expiresTime),
        },
      });
      setOpen(false);
      onSaved(res.offer);
    } catch {
      // Validation rejections leave the dialog open for correction.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          const next = bootExpiry(offer);
          setCasino(offer.casino ?? "");
          setTitle(offer.title);
          setNotes(offer.notes ?? "");
          setExpiresDate(next.date);
          setExpiresTime(next.time);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label="Edit campaign"
        >
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit campaign</DialogTitle>
          <DialogDescription>Casino, title and notes - steps are edited on their own row.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <VenueSelect
            value={casino}
            onChange={setCasino}
            label="Casino"
            placeholder="Select bookie"
            kinds={["bookie"]}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-casino-title" className="text-xs text-muted-foreground">
              Offer
            </Label>
            <Input id="edit-casino-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-casino-expires-date" className="text-xs text-muted-foreground">
                Expires
              </Label>
              <DatePicker
                id="edit-casino-expires-date"
                value={expiresDate}
                onChange={setExpiresDate}
                placeholder="Pick a date"
                shortcuts="ending"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-casino-expires-time" className="text-xs text-muted-foreground">
                Time
              </Label>
              <EventTimeInput
                id="edit-casino-expires-time"
                value={expiresTime}
                onChange={setExpiresTime}
                placeholder="Pick a time"
                shortcuts="ending"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-casino-notes" className="text-xs text-muted-foreground">
              Notes
            </Label>
            <textarea
              id="edit-casino-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(
                fieldControl,
                "min-h-[4.5rem] w-full resize-y px-3 py-2 text-sm outline-none"
              )}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !title.trim()}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
