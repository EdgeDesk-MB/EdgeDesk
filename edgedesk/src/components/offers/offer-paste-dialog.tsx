"use client";

import { useMemo, useState } from "react";
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
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import { PasteCapture } from "@/components/paste-capture";
import {
  parseOfferFromText,
  type ParsedOfferDraft,
} from "@/lib/offers/parse-offer-text";
import { formatImportantTermsSummary, formatOfferExpiry } from "@/lib/offers/offer-terms";
import { OFFER_CATEGORIES } from "@/lib/offers/offer-categories";
import { cn } from "@/lib/utils";
import { ClipboardPaste } from "lucide-react";

export function OfferPasteDialog({
  onApply,
}: {
  onApply: (draft: ParsedOfferDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const draft = useMemo(
    () => (text.trim() ? parseOfferFromText(text) : null),
    [text]
  );

  function apply() {
    if (!draft || !draft.title.trim()) return;
    onApply(draft);
    setOpen(false);
    setText("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setText("");
      }}
    >
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
            Paste text, or drop / paste screenshots (usually 2–3). We merge them
            into one offer on your device - check before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <PasteCapture
            text={text}
            onTextChange={setText}
            placeholder={`Sky Bet
Bet £10 get £30 free bet - Premier League
Min odds 1.50 · New customers only
Expires 31 Jul 2026 at 11:59pm`}
          />

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
            <Button type="button" onClick={apply} disabled={!draft?.title.trim()}>
              Apply to form
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
