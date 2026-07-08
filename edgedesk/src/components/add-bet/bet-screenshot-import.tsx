"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilePond, registerPlugin } from "react-filepond";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { ocrBetScreenshot } from "@/lib/ocr/extract-text";
import type { BetOcrFields, ScreenshotSource } from "@/lib/ocr/types";
import { cn } from "@/lib/utils";
import { Loader2, ScanLine } from "lucide-react";

import "filepond/dist/filepond.min.css";

registerPlugin();

interface BetScreenshotImportProps {
  open: boolean;
  onApply: (fields: BetOcrFields, source: ScreenshotSource) => void | Promise<void>;
  className?: string;
}

function ScreenshotDrop({
  label,
  hint,
  source,
  active,
  onHover,
  onFile,
  processing,
}: {
  label: string;
  hint: string;
  source: ScreenshotSource;
  active: boolean;
  onHover: () => void;
  onFile: (file: File, source: ScreenshotSource) => void;
  processing: boolean;
}) {
  const pondRef = useRef<{ removeFiles: () => void } | null>(null);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-dashed p-2 transition-colors",
        active ? "border-primary/50 bg-primary/5" : "border-muted-foreground/25 bg-muted/20"
      )}
      onMouseEnter={onHover}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
        {processing && active && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
      <FilePond
        ref={pondRef as never}
        allowMultiple={false}
        maxFiles={1}
        allowReplace
        acceptedFileTypes={["image/png", "image/jpeg", "image/webp", "image/gif"]}
        labelIdle={hint}
        credits={false}
        className="bet-screenshot-pond"
        onaddfile={(_err, fileItem) => {
          const file = fileItem.file;
          if (file instanceof File) onFile(file, source);
          pondRef.current?.removeFiles();
        }}
      />
    </div>
  );
}

/**
 * Drag-and-drop / paste screenshot import for bookie + exchange slips.
 * Uses free client-side OCR (Tesseract.js) — results are best-effort hints.
 */
export function BetScreenshotImport({ open, onApply, className }: BetScreenshotImportProps) {
  const [activeSource, setActiveSource] = useState<ScreenshotSource>("bookie");
  const [processing, setProcessing] = useState<ScreenshotSource | null>(null);
  const activeSourceRef = useRef(activeSource);
  activeSourceRef.current = activeSource;

  const processFile = useCallback(
    async (file: File, source: ScreenshotSource) => {
      setProcessing(source);
      try {
        const result = await ocrBetScreenshot(file, source);
        if (result.summary.length === 0) {
          toast.warning("Could not read much from that screenshot", {
            description:
              "Try a clearer crop of the bet slip. OCR works best on sharp, high-contrast images.",
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
      } catch (e) {
        toast.error("OCR failed", { description: String(e) });
      } finally {
        setProcessing(null);
      }
    },
    [onApply]
  );

  /** Paste into the active zone while the modal is open (skip text fields). */
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

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ScanLine className="size-3.5 shrink-0" />
        <span>
          Drop or paste screenshots — reads labelled fields (Odds, Stake, Matched Stake/Odds,
          Win · time · course). Returns are ignored for odds. Always check values.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ScreenshotDrop
          label="1 · Bookie"
          hint='Drop or paste <span class="filepond--label-action">bookie slip</span>'
          source="bookie"
          active={activeSource === "bookie"}
          onHover={() => setActiveSource("bookie")}
          onFile={processFile}
          processing={processing === "bookie"}
        />
        <ScreenshotDrop
          label="2 · Exchange"
          hint='Drop or paste <span class="filepond--label-action">exchange slip</span>'
          source="exchange"
          active={activeSource === "exchange"}
          onHover={() => setActiveSource("exchange")}
          onFile={processFile}
          processing={processing === "exchange"}
        />
      </div>
    </div>
  );
}
