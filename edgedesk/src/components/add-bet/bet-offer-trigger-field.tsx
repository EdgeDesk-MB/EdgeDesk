"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AiTriggerPreview } from "@/lib/calc/ai-triggers";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";

export function BetOfferTriggerField({
  value,
  onChange,
  preview,
  needsEventLink,
  needsTeamNames,
}: {
  value: string;
  onChange: (value: string) => void;
  preview: AiTriggerPreview;
  needsEventLink?: boolean;
  needsTeamNames?: boolean;
}) {
  const hasInput = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/15 p-3">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">Offer trigger</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Describe the promo so free bets and place refunds auto-apply at settlement.
          </p>
        </div>
      </div>

      <Input
        placeholder="e.g. Bet £50 get £50 FB if 2nd, 3rd, 4th"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 bg-background"
      />

      {hasInput ? (
        <div
          className={cn(
            "rounded-md border px-2.5 py-2 text-[11px] leading-snug",
            preview.recognised
              ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
              : "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-200"
          )}
        >
          {preview.recognised ? (
            <div className="flex flex-col gap-1">
              {preview.lines.map((line) => (
                <div key={line} className="flex items-start gap-1.5">
                  <CircleCheck className="mt-0.5 size-3 shrink-0 opacity-80" aria-hidden />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-1.5">
              <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>Saved as a note only — we couldn&apos;t parse an offer rule from that.</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] leading-snug text-muted-foreground">
          Straight free bet:{" "}
          <span className="text-foreground/80">Bet £50 get £50</span>
          {" · "}
          Place refund:{" "}
          <span className="text-foreground/80">Bet £50 get £50 FB if 2nd, 3rd, 4th</span>
        </p>
      )}

      {needsEventLink ? (
        <p className="text-[10px] text-muted-foreground">
          Link an event and selection so place triggers can run when the result lands.
        </p>
      ) : null}
      {needsTeamNames ? (
        <p className="text-[10px] text-muted-foreground">
          Enter team names or link a fixture so match triggers can watch the score.
        </p>
      ) : null}
    </div>
  );
}
