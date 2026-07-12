"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseBetText } from "@/lib/bets/parse-bet-text";
import type { BetOcrFields } from "@/lib/ocr/types";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

interface BetTextImportProps {
  onApply: (fields: BetOcrFields) => void;
  className?: string;
}

/** Flatten ParsedBet confident values into the existing BetOcrFields shape. */
function toOcrFields(parsed: ReturnType<typeof parseBetText>): BetOcrFields {
  if (!parsed) return {};
  return {
    bookmaker: parsed.bookmaker?.value,
    backStake: parsed.backStake?.value,
    backOdds: parsed.backOdds?.value,
    selection: parsed.selection?.value,
    isFreeBet: parsed.isFreeBet,
    marketHint: parsed.marketHint?.value,
  };
}

/**
 * Paste-text affordance: paste raw bookie confirmation text → parsed prefill.
 * Shows a confidence caveat — user always reviews before saving.
 */
export function BetTextImport({ onApply, className }: BetTextImportProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleParse() {
    setError(null);
    const result = parseBetText(text);
    if (!result) {
      setError("Nothing useful found — try pasting the full confirmation text.");
      return;
    }
    onApply(toOcrFields(result));
    setText("");
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border border-border/60 bg-muted/15 p-3",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <ClipboardList className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Paste bet text</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Paste bookie confirmation text to prefill odds, stake and selection.
            Always review — never auto-submitted.
          </p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="Paste bet confirmation text here…"
        className="min-h-[5.5rem] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Bet confirmation text"
      />

      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-end h-7 text-[11px]"
        disabled={!text.trim()}
        onClick={handleParse}
      >
        Parse &amp; prefill
      </Button>
    </div>
  );
}
