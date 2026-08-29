"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { ShortcutRowList } from "@/components/keyboard/shortcut-row-list";
import {
  filterShortcutRows,
  SHORTCUT_SHEET_HELP_HREF,
  SHORTCUT_SHEET_ROWS,
} from "@/lib/keyboard/desk-shortcut-sheet";

export function DeskShortcutSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setQuery("");
  }

  const rows = useMemo(
    () => filterShortcutRows(SHORTCUT_SHEET_ROWS, query),
    [query]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(34rem,85vh)] min-h-0 max-w-md flex-col gap-3 overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Daily chords, desk jumps and the palette.
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 shrink-0">
          <label className="sr-only" htmlFor="desk-shortcut-filter">
            Filter shortcuts
          </label>
          <Input
            id="desk-shortcut-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter shortcuts"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ScrollFadeEdges
          className="min-h-0 flex-1"
          fadeClassName="from-page dark:from-card"
          scrollClassName="app-scroll-nested pr-2"
        >
          {rows.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-muted-foreground">
              No matching shortcuts.
            </p>
          ) : (
            <ShortcutRowList rows={rows} grouped />
          )}
        </ScrollFadeEdges>
        <p className="shrink-0 text-xs text-muted-foreground">
          <Link
            href={SHORTCUT_SHEET_HELP_HREF}
            className="text-primary-text underline-offset-2 hover:underline"
            onClick={() => onOpenChange(false)}
          >
            Full keyboard guide
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
