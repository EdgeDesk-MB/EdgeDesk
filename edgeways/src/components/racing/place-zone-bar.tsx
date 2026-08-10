"use client";

import { cn } from "@/lib/utils";

/**
 * Horizontal place ladder: equal-width Acca-style meters per finishing position.
 * Standard (exchange) places are solid and readable; extra bookie places are louder.
 * A 4-place group is wider than a 3-place group because each slot shares the same width.
 */
export function PlaceZoneBar({
  exchangePlaces,
  bookiePlaces,
  className,
  compact,
}: {
  exchangePlaces: number;
  bookiePlaces: number;
  className?: string;
  compact?: boolean;
}) {
  const ex = Math.max(0, Math.floor(exchangePlaces));
  const bookie = Math.max(ex, Math.floor(bookiePlaces));
  const extraStart = ex + 1;
  const hasExtra = bookie > ex;
  const slots = Array.from({ length: Math.max(bookie, 1) }, (_, i) => i + 1);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="flex flex-wrap items-end gap-x-2.5 gap-y-1.5"
        role="img"
        aria-label={
          hasExtra
            ? `Exchange places 1–${ex}; bookie extra ${extraStart}–${bookie}`
            : `Places 1–${ex}`
        }
      >
        {slots.map((n) => {
          const isExtra = n > ex;
          return (
            <div
              key={n}
              className={cn(
                "flex shrink-0 flex-col gap-1",
                compact ? "w-[44px]" : "w-[52px]"
              )}
              title={
                isExtra
                  ? `${n}${ordinal(n)} — extra place (bookie pays, place lay wins)`
                  : `${n}${ordinal(n)} — standard place (exchange place market)`
              }
            >
              <div className="flex items-baseline justify-between gap-1 text-[10px] font-semibold uppercase tracking-wide">
                <span
                  className={cn(
                    isExtra
                      ? "text-success"
                      : "text-foreground/80 dark:text-foreground/90"
                  )}
                >
                  {n}
                  {ordinal(n)}
                </span>
                {isExtra ? (
                  <span className="text-[9px] font-bold text-success">EP</span>
                ) : null}
              </div>
              <div
                className={cn(
                  "w-full overflow-hidden rounded-full bg-muted",
                  isExtra ? "h-2" : compact ? "h-1.5" : "h-[7px]"
                )}
              >
                <div
                  className={cn(
                    "h-full w-full rounded-full",
                    isExtra ? "bg-success" : "bg-muted-foreground"
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>
            Ex {ex > 0 ? `1–${ex}` : "—"}
          </span>
          {hasExtra ? (
            <span className="font-medium text-success">
              Extra {extraStart}–{bookie}
            </span>
          ) : (
            <span>No extra places</span>
          )}
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  if (n % 10 === 1) return "st";
  if (n % 10 === 2) return "nd";
  if (n % 10 === 3) return "rd";
  return "th";
}
