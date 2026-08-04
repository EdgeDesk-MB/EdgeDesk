"use client";

/**
 * Casino paste-to-prefill (H2) - the Casino desk's counterpart to the offers
 * paste dialog. Screenshots or text in, parsed bonus / wagering / RTP /
 * contribution out, applied to the log-offer form for a final human check.
 */

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
import { PasteCapture } from "@/components/paste-capture";
import {
  parseCasinoOfferText,
  type ParsedCasinoOfferDraft,
} from "@/lib/offers/parse-casino-offer-text";
import { ClipboardPaste } from "lucide-react";

export function CasinoPasteDialog({
  onApply,
}: {
  onApply: (draft: ParsedCasinoOfferDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const draft = useMemo(
    () => (text.trim() ? parseCasinoOfferText(text) : null),
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
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <ClipboardPaste className="size-3.5" />
          Paste offer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paste a casino promo</DialogTitle>
          <DialogDescription>
            Paste text, or drop / paste screenshots - bonus, wagering and game
            terms are read on your device. Check the numbers before applying.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <PasteCapture
            text={text}
            onTextChange={setText}
            textLabel="Promo text"
            placeholder={`Sky Vegas
Stake £10 get a £20 casino bonus
35x wagering · Selected slots only · RTP 96.5%`}
          />

          {draft && text.trim() && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">Preview</span>
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
              <p className="text-sm font-semibold leading-snug">
                {draft.casino ? `${draft.casino} · ` : ""}
                {draft.title || "-"}
              </p>
              {draft.notes.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
                  {draft.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  No bonus or wagering terms detected yet - keep pasting, or fill
                  the form manually.
                </p>
              )}
              {draft.wageringMultiplier == null && draft.bonusAmount != null ? (
                <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-300">
                  Wagering not detected - check the promo terms and set it in the
                  form.
                </p>
              ) : null}
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
