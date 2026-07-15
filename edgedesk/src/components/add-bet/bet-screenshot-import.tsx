"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ocrBetScreenshot } from "@/lib/ocr/extract-text";
import type { BetOcrFields, ScreenshotSource } from "@/lib/ocr/types";
import { filterPillGroup } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ClipboardPaste, Loader2, ScanLine } from "lucide-react";

interface BetScreenshotImportProps {
  open: boolean;
  onApply: (fields: BetOcrFields, source: ScreenshotSource) => void | Promise<void>;
  className?: string;
}

const SOURCE_LABEL: Record<ScreenshotSource, string> = {
  bookie: "Bookie slip",
  exchange: "Exchange slip",
};

/** Softer than page-level filterPillState — lifted pill on the muted track, tinted to match paste zone. */
function slipTabState(active: boolean, source: ScreenshotSource) {
  return cn(
    "inline-flex w-full items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
    active
      ? source === "bookie"
        ? "bg-card text-foreground shadow-sm ring-1 ring-amber-500/30"
        : "bg-card text-foreground shadow-sm ring-1 ring-emerald-500/30"
      : "text-muted-foreground hover:text-foreground"
  );
}

/**
 * Paste-only screenshot import for bookie + exchange slips.
 * Uses free client-side OCR (Tesseract.js) — results are best-effort hints.
 */
export function BetScreenshotImport({ open, onApply, className }: BetScreenshotImportProps) {
  const [activeSource, setActiveSource] = useState<ScreenshotSource>("bookie");
  const [processing, setProcessing] = useState<ScreenshotSource | null>(null);
  const activeSourceRef = useRef(activeSource);
  useEffect(() => {
    activeSourceRef.current = activeSource;
  }, [activeSource]);

  const processFile = useCallback(
    async (file: File, source: ScreenshotSource) => {
      setProcessing(source);
      try {
        const result = await ocrBetScreenshot(file, source);
        if (result.summary.length === 0) {
          toast.warning("Couldn't read much from that screenshot", {
            description:
              "Try a sharper crop of the slip. High-contrast PNG or JPEG works best.",
          });
          return;
        }
        await onApply(result.fields, source);
        toast.success(
          source === "bookie" ? "Bookie details imported" : "Exchange details imported",
          {
            description: result.summary.join(" · "),
          }
        );
      } catch {
        toast.error("Couldn't read that screenshot", {
          description: "Try a clearer crop, or enter the bet details manually.",
        });
      } finally {
        setProcessing(null);
      }
    },
    [onApply]
  );

  /** Paste into the active slip zone while the modal is open (skip text fields). */
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        void processFile(file, activeSourceRef.current);
        break;
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, processFile]);

  const busy = processing != null;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border border-border/60 bg-muted/15 p-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <ScanLine className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Import from screenshot</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Paste a slip image to fill odds, stake and event hints. Returns are ignored —
            always check values before saving.
          </p>
        </div>
      </div>

      <div
        className={cn(filterPillGroup, "grid w-full grid-cols-2 gap-0.5 p-0.5")}
        role="tablist"
        aria-label="Screenshot target"
      >
        {(["bookie", "exchange"] as const).map((source) => (
          <button
            key={source}
            type="button"
            role="tab"
            aria-selected={activeSource === source}
            disabled={busy}
            onClick={() => setActiveSource(source)}
            className={cn(
              slipTabState(activeSource === source, source),
              "disabled:opacity-50"
            )}
          >
            {SOURCE_LABEL[source]}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
          activeSource === "bookie"
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-emerald-500/30 bg-emerald-500/5",
          busy && "pointer-events-none opacity-70"
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <ClipboardPaste className="size-5 text-muted-foreground" aria-hidden />
        )}
        <p className="text-xs text-muted-foreground">
          {busy
            ? `Reading ${SOURCE_LABEL[processing!].toLowerCase()}…`
            : `Paste ${SOURCE_LABEL[activeSource].toLowerCase()} (⌘V / Ctrl+V)`}
        </p>
        <p className="text-[10px] leading-snug text-muted-foreground/80">
          Odds · stake · matched stake/odds · win · time · course
        </p>
      </div>
    </div>
  );
}
