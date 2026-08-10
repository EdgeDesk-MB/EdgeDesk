"use client";

/**
 * Shared paste/OCR capture block - drop or paste screenshots (read on-device
 * via OCR) and/or paste text, merged into one editable text box. Extracted
 * from the offers paste dialog so the Casino desk (H2) reuses the exact
 * capture behaviour; the parent owns the text and its parser/preview.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ocrOfferScreenshots } from "@/lib/ocr/extract-text";
import { parseEmlToOfferText } from "@/lib/offers/parse-email";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { ImageIcon, Loader2, ScanLine, X } from "lucide-react";

/** Typical MBB / promo flows use 2–3 crops; hard cap keeps OCR snappy. */
const MAX_SCREENSHOTS = 5;

type Shot = {
  id: string;
  url: string;
  fileName: string;
  text: string;
  confidence: number;
};

function mergeOcrBlocks(shots: Shot[]): string {
  return shots
    .map((s) => s.text.trim())
    .filter((t) => t.length >= 8)
    .join("\n\n");
}

function collectImageFiles(
  list: FileList | File[] | DataTransferItemList | null | undefined
): File[] {
  if (!list) return [];
  const files: File[] = [];
  if (list instanceof DataTransferItemList) {
    for (const item of list) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
    return files;
  }
  for (const file of Array.from(list as FileList | File[])) {
    if (file.type.startsWith("image/")) files.push(file);
  }
  return files;
}

function collectEmlFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list as FileList | File[]).filter(
    (f) => f.name.toLowerCase().endsWith(".eml") || f.type === "message/rfc822"
  );
}

export function PasteCapture({
  text,
  onTextChange,
  textLabel = "Offer text",
  placeholder,
  /** Compact strip for inline form paste — smaller drop zone, source text collapsed. */
  dense = false,
}: {
  text: string;
  onTextChange: (text: string) => void;
  textLabel?: string;
  placeholder?: string;
  dense?: boolean;
}) {
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(!dense);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);

  /** Keep the ref exact in the same tick - async OCR batches read it. */
  const applyShots = useCallback((next: Shot[]) => {
    shotsRef.current = next;
    setShots(next);
  }, []);

  // Radix unmounts dialog content on close, so mounted = capture active;
  // revoke preview URLs on the way out.
  useEffect(() => {
    return () => {
      for (const s of shotsRef.current) URL.revokeObjectURL(s.url);
    };
  }, []);

  // NB: never call onTextChange (parent setState) inside a setShots updater -
  // updaters run during render and cross-component updates there are illegal.
  const removeShot = useCallback(
    (id: string) => {
      const prev = shotsRef.current;
      const hit = prev.find((s) => s.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      const next = prev.filter((s) => s.id !== id);
      applyShots(next);
      onTextChange(mergeOcrBlocks(next));
    },
    [onTextChange, applyShots]
  );

  const runOcrBatch = useCallback(
    async (incoming: File[]) => {
      const images = incoming.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        toast.error("No images found", {
          description: "Paste or drop PNG / JPEG screenshots of the offer.",
        });
        return;
      }

      const room = MAX_SCREENSHOTS - shotsRef.current.length;
      if (room <= 0) {
        toast.message(`Already at ${MAX_SCREENSHOTS} screenshots`, {
          description: "Remove one before adding more.",
        });
        return;
      }

      const batch = images.slice(0, room);
      if (images.length > room) {
        toast.message(`Added ${batch.length} of ${images.length}`, {
          description: `Max ${MAX_SCREENSHOTS} screenshots per paste.`,
        });
      }

      setOcrBusy(true);
      setOcrProgress(
        batch.length === 1
          ? "Reading screenshot…"
          : `Reading ${batch.length} screenshots…`
      );

      try {
        const results = await ocrOfferScreenshots(batch);
        const added: Shot[] = [];
        let weak = 0;

        for (let i = 0; i < results.length; i++) {
          const cleaned = results[i].text.replace(/\u00a0/g, " ").trim();
          if (!cleaned || cleaned.length < 12) {
            weak += 1;
            continue;
          }
          added.push({
            id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            url: URL.createObjectURL(batch[i]),
            fileName: results[i].fileName || batch[i].name || `Shot ${i + 1}`,
            text: cleaned,
            confidence: results[i].confidence,
          });
        }

        if (added.length === 0) {
          toast.warning("Couldn’t read much from those screenshots", {
            description:
              "Try sharper crops of the offer text, or paste / type the text below.",
          });
          return;
        }

        const next = [...shotsRef.current, ...added].slice(0, MAX_SCREENSHOTS);
        applyShots(next);
        onTextChange(mergeOcrBlocks(next));

        const avg =
          added.reduce((s, a) => s + a.confidence, 0) / Math.max(1, added.length);
        toast.success(
          added.length === 1
            ? "Screenshot read"
            : `${added.length} screenshots read`,
          {
            description: [
              `~${Math.round(avg)}% accurate`,
              weak > 0 ? `${weak} skipped (too little text)` : null,
              dense ? "Fields update as text is merged." : "Check the merged text.",
            ]
              .filter(Boolean)
              .join(" · "),
          }
        );
      } catch {
        toast.error("Couldn't read screenshot", {
          description: "Try a sharper crop, or paste the offer text instead.",
        });
      } finally {
        setOcrBusy(false);
        setOcrProgress(null);
      }
    },
    [onTextChange, applyShots, dense]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target;
      const images = collectImageFiles(e.clipboardData?.items);
      if (images.length > 0) {
        e.preventDefault();
        void runOcrBatch(images);
        return;
      }
      if (
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLInputElement)
      ) {
        const pasted = e.clipboardData?.getData("text/plain")?.trim();
        if (pasted) {
          e.preventDefault();
          onTextChange(text ? `${text.trim()}\n\n${pasted}` : pasted);
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [runOcrBatch, onTextChange, text]);

  /** J6 stage 1: dropped promo emails parse locally into the text box. */
  const ingestEmlFiles = useCallback(
    async (files: File[]) => {
      let combined = text;
      let added = 0;
      for (const file of files) {
        const parsed = parseEmlToOfferText(await file.text());
        if (!parsed) {
          toast.error("Could not read that email", { description: file.name });
          continue;
        }
        added += 1;
        combined = combined ? `${combined.trim()}\n\n${parsed.offerText}` : parsed.offerText;
      }
      if (added > 0) {
        onTextChange(combined);
        toast.success(added === 1 ? "Email added" : `${added} emails added`, {
          description: dense
            ? "Parsed locally - form fields update from the text."
            : "Parsed locally - check the text below.",
        });
      }
    },
    [onTextChange, text, dense]
  );

  const canAddMore = shots.length < MAX_SCREENSHOTS;

  return (
    <>
      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center transition-colors",
          dense ? "px-3 py-2.5" : "px-3 py-4",
          dragOver
            ? "border-primary/50 bg-primary/5"
            : "border-muted-foreground/25 bg-muted/20",
          ocrBusy && "pointer-events-none opacity-70"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const emls = collectEmlFiles(e.dataTransfer.files);
          if (emls.length) void ingestEmlFiles(emls);
          void runOcrBatch(collectImageFiles(e.dataTransfer.files));
        }}
      >
        {ocrBusy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <ScanLine className="size-5 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground">
          {ocrProgress ??
            (canAddMore
              ? dense
                ? "Drop or paste screenshots, .eml or text; fields fill below"
                : "Drop screenshots or a promo email (.eml), paste (⌘V / Ctrl+V), or choose files"
              : `Maximum ${MAX_SCREENSHOTS} screenshots - remove one to add more`)}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={ocrBusy || !canAddMore}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="size-3.5" />
            {shots.length > 0 ? "Add images" : "Choose images"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.eml,message/rfc822"
            multiple
            className="hidden"
            onChange={(e) => {
              const images = collectImageFiles(e.target.files);
              const emls = collectEmlFiles(e.target.files);
              e.target.value = "";
              if (emls.length) void ingestEmlFiles(emls);
              if (images.length) void runOcrBatch(images);
            }}
          />
        </div>

        {shots.length > 0 && (
          <div className="mt-1 flex w-full flex-wrap justify-center gap-2">
            {shots.map((shot, i) => (
              <div
                key={shot.id}
                className="relative w-[5.5rem] shrink-0 overflow-hidden rounded-md border bg-background"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`Screenshot ${i + 1}`}
                  className="h-16 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-1 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  <span className="truncate">#{i + 1}</span>
                  <span className="tabular-nums">
                    {Math.round(shot.confidence)}%
                  </span>
                </div>
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow"
                  onClick={() => removeShot(shot.id)}
                  aria-label={`Remove screenshot ${i + 1}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          {dense ? (
            <button
              type="button"
              className="rounded-sm text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSourceOpen((v) => !v)}
              aria-expanded={sourceOpen}
              aria-controls="paste-capture-source"
            >
              {sourceOpen ? "Hide source text" : "Show source text"}
              {text.trim() ? ` · ${text.trim().length.toLocaleString()} chars` : ""}
            </button>
          ) : (
            <Label className="text-xs text-muted-foreground">{textLabel}</Label>
          )}
          {shots.length > 1 && (
            <span className="text-xs text-muted-foreground">
              Merged from {shots.length} screenshots
            </span>
          )}
        </div>
        {sourceOpen ? (
          <textarea
            id="paste-capture-source"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={dense ? 4 : 8}
            placeholder={placeholder}
            className={cn(
              fieldControl,
              "w-full resize-y px-3 py-2 text-sm outline-none",
              dense ? "min-h-[5rem]" : "min-h-[10rem]"
            )}
          />
        ) : null}
      </div>
    </>
  );
}
