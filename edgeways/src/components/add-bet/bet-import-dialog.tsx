"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BetTextImport } from "@/components/add-bet/bet-text-import";
import type { BetOcrFields, ScreenshotSource } from "@/lib/ocr/types";
import { ScanLine } from "lucide-react";

const BetScreenshotImport = dynamic(
  () =>
    import("@/components/add-bet/bet-screenshot-import").then((m) => ({
      default: m.BetScreenshotImport,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
        Loading screenshot import…
      </div>
    ),
  }
);

/**
 * Trigger button + dialog that surfaces screenshot OCR and text paste in one place.
 * Closes itself after a successful apply from either section.
 */
export function BetImportDialog({
  onApply,
  defaultOpen = false,
}: {
  onApply: (fields: BetOcrFields, source: ScreenshotSource) => void | Promise<void>;
  /** Quick-log "Paste slip" path opens the import immediately (keyed remount). */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  async function handleApply(fields: BetOcrFields, source: ScreenshotSource) {
    await onApply(fields, source);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 self-start">
          <ScanLine className="size-3.5" aria-hidden />
          Paste slip
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Paste slip</DialogTitle>
          <DialogDescription>
            Paste a screenshot or confirmation to pre-fill.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <BetScreenshotImport open={open} onApply={handleApply} />
          <BetTextImport
            onApply={(fields) => void handleApply(fields, "bookie")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
