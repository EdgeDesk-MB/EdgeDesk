"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/hooks/use-app-state";
import type { HistoryRow } from "@/lib/db/schema";
import { balanceAdjustmentAccountName } from "@/lib/history-display";
import { cn } from "@/lib/utils";

export function balanceCorrectionNoteText(entry: HistoryRow): string | undefined {
  if (entry.kind !== "balance_adjustment") return undefined;
  const note = entry.note?.trim();
  return note || undefined;
}

/** Compact note icon that opens the add/edit modal for a balance correction. */
export function BalanceCorrectionNoteButton({
  entry,
  onSaved,
  className,
}: {
  entry: HistoryRow;
  onSaved?: (note: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(entry.note ?? "");
  const [saving, setSaving] = useState(false);
  const hasNote = Boolean(entry.note?.trim());

  const [prevSync, setPrevSync] = useState({ open, note: entry.note });
  if (prevSync.open !== open || prevSync.note !== entry.note) {
    setPrevSync({ open, note: entry.note });
    if (open) setDraft(entry.note ?? "");
  }

  if (entry.kind !== "balance_adjustment") return null;

  async function save(nextDraft = draft) {
    setSaving(true);
    try {
      const next = nextDraft.trim() || null;
      await api<{ entry: HistoryRow }>(`/api/history/${entry.id}`, {
        method: "PATCH",
        json: { note: next },
      });
      toast.success(next ? "Note saved" : "Note cleared");
      setOpen(false);
      onSaved?.(next);
    } catch (e) {
      toast.error("Could not save note", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "size-5 shrink-0 text-muted-foreground hover:text-foreground",
          hasNote && "text-primary-text hover:text-primary-text",
          className
        )}
        aria-label={hasNote ? "Edit correction note" : "Add correction note"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <StickyNote className={cn("size-3", hasNote && "fill-primary/15")} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{hasNote ? "Edit note" : "Add note"}</DialogTitle>
            <DialogDescription>
              What this balance correction was for.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`history-note-${entry.id}`} className="text-xs text-muted-foreground">
              Note
            </Label>
            <Input
              id={`history-note-${entry.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Tote rebate, missed free bet"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void save();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {hasNote ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                className="sm:mr-auto"
                onClick={() => {
                  setDraft("");
                  void save("");
                }}
              >
                Clear
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Single secondary line for balance corrections:
 * `BetMGM - [note icon] Daily spins` (or bookie + icon when no note).
 */
export function BalanceCorrectionDetailLine({
  entry,
  note,
  onSaved,
  className,
  textClassName,
}: {
  entry: HistoryRow;
  note?: string;
  onSaved?: (note: string | null) => void;
  className?: string;
  textClassName?: string;
}) {
  if (entry.kind !== "balance_adjustment") return null;
  const account = balanceAdjustmentAccountName(entry);
  const noteText = note?.trim() || undefined;

  return (
    <span
      className={cn(
        "mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      {account ? (
        <span className={cn("truncate", textClassName)}>{account}</span>
      ) : null}
      {account && noteText ? (
        <span className="shrink-0" aria-hidden>
          -
        </span>
      ) : null}
      <BalanceCorrectionNoteButton entry={entry} onSaved={onSaved} />
      {noteText ? (
        <span className={cn("min-w-0 truncate", textClassName)}>{noteText}</span>
      ) : null}
    </span>
  );
}
