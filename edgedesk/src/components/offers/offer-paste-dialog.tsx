"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import {
  parseOfferFromText,
  type ParsedOfferDraft,
} from "@/lib/offers/parse-offer-text";
import { formatImportantTermsSummary, formatOfferExpiry } from "@/lib/offers/offer-terms";
import { OFFER_CATEGORIES } from "@/lib/offers/offer-categories";
import { ocrOfferScreenshots } from "@/lib/ocr/extract-text";
import { cn } from "@/lib/utils";
import { ClipboardPaste, ImageIcon, Loader2, ScanLine, X } from "lucide-react";

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

export function OfferPasteDialog({
  onApply,
}: {
  onApply: (draft: ParsedOfferDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;

  const draft = useMemo(
    () => (text.trim() ? parseOfferFromText(text) : null),
    [text]
  );

  function revokeAll(list: Shot[]) {
    for (const s of list) URL.revokeObjectURL(s.url);
  }

  function reset() {
    revokeAll(shotsRef.current);
    setShots([]);
    setText("");
    setOcrBusy(false);
    setOcrProgress(null);
    setDragOver(false);
  }

  const removeShot = useCallback((id: string) => {
    setShots((prev) => {
      const hit = prev.find((s) => s.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      const next = prev.filter((s) => s.id !== id);
      setText(mergeOcrBlocks(next));
      return next;
    });
  }, []);

  const runOcrBatch = useCallback(async (incoming: File[]) => {
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

      setShots((prev) => {
        const next = [...prev, ...added].slice(0, MAX_SCREENSHOTS);
        setText(mergeOcrBlocks(next));
        return next;
      });

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
            "Check the merged text before applying.",
          ]
            .filter(Boolean)
            .join(" · "),
        }
      );
    } catch (e) {
      toast.error("Couldn't read screenshot", {
        description: "Try a sharper crop, or paste the offer text instead.",
      });
    } finally {
      setOcrBusy(false);
      setOcrProgress(null);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
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
          setText((prev) => (prev ? `${prev.trim()}\n\n${pasted}` : pasted));
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, runOcrBatch]);

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on close
  }, [open]);

  function apply() {
    if (!draft || !draft.title.trim()) return;
    onApply(draft);
    setOpen(false);
    reset();
  }

  const canAddMore = shots.length < MAX_SCREENSHOTS;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-8 gap-1.5">
          <ClipboardPaste className="size-3.5" />
          Paste offer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste from MBB / promo</DialogTitle>
          <DialogDescription>
            Paste text, or drop / paste up to {MAX_SCREENSHOTS} screenshots
            (usually 2–3). We merge them into one offer on your device - check
            before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
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
                  ? "Drop or paste screenshots (⌘V / Ctrl+V), or choose files"
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
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = collectImageFiles(e.target.files);
                  e.target.value = "";
                  if (files.length) void runOcrBatch(files);
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
                    <div className="flex items-center justify-between gap-1 px-1.5 py-0.5 text-[10px] text-muted-foreground">
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
              <Label className="text-xs text-muted-foreground">Offer text</Label>
              {shots.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  Merged from {shots.length} screenshots
                </span>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={`Sky Bet
Bet £10 get £30 free bet - Premier League
Min odds 1.50 · New customers only
Expires 31 Jul 2026 at 11:59pm`}
              className="min-h-[10rem] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
            />
          </div>

          {draft && text.trim() && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Preview</span>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <OfferCategoryIcon
                    category={draft.category}
                    size={11}
                    className="opacity-80"
                  />
                  {OFFER_CATEGORIES.find((c) => c.id === draft.category)?.label ??
                    draft.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    draft.confidence === "high"
                      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                      : draft.confidence === "medium"
                        ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                        : undefined
                  }
                >
                  {draft.confidence} confidence
                </Badge>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold leading-snug",
                  draft.freeBetAmount != null
                    ? "text-violet-700 dark:text-violet-300"
                    : "text-foreground"
                )}
              >
                {draft.title || "-"}
              </p>
              {draft.expectedProfit != null && (
                <p className="mt-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Est. profit ~£{draft.expectedProfit}
                  {draft.intelligence?.archetypeLabel
                    ? ` · ${draft.intelligence.archetypeLabel}`
                    : ""}
                </p>
              )}
              {draft.expiresAt != null ? (
                <p className="mt-1 text-[11px] font-medium text-sky-800 dark:text-sky-300">
                  Expires {formatOfferExpiry(draft.expiresAt)}
                </p>
              ) : /\b(?:valid|until|expires?|deadline|11[.:]00|10am)\b/i.test(text) ? (
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                  Expiry not detected - set the deadline manually in Details.
                </p>
              ) : null}
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
                {draft.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {formatImportantTermsSummary(draft.important) && (
                <div className="mt-2 flex gap-2 rounded-md border border-amber-500/35 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                  <span className="font-medium">Important</span>
                  <span>{formatImportantTermsSummary(draft.important)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={apply}
              disabled={!draft?.title.trim() || ocrBusy}
            >
              Apply to form
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
