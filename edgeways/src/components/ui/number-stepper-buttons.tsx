"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared Tailwind spacing-scale inset the radius below assumes. */
const STEPPER_GAP_PX = { default: 4, compact: 2 } as const;

const buttonClass = cn(
  "flex flex-1 items-center justify-center bg-black/10 text-black/55 outline-none transition-colors",
  "hover:bg-black/20 hover:text-black/75 focus-visible:ring-2 focus-visible:ring-primary/40",
  "disabled:pointer-events-none disabled:opacity-40",
  "dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white/85"
);

/**
 * Up/down stepper buttons for a numeric field, inset from the field's edge by
 * `gap-1` on every side and between the two buttons. Corner radius is derived
 * from the field's own radius token minus that inset, so the outer corners
 * stay concentric with the field. Inner corners (plus bottom, minus top)
 * use half that radius. Neutral black/white opacity, never brand green/red,
 * so it reads on any bookie/exchange panel tint (same rule as `Switch`
 * `tone="onPanel"`).
 */
export function NumberStepperButtons({
  onStepUp,
  onStepDown,
  disabled,
  fieldRadius = "var(--radius-md)",
  density = "default",
  upLabel = "Increase",
  downLabel = "Decrease",
  className,
}: {
  onStepUp: () => void;
  onStepDown: () => void;
  disabled?: boolean;
  /** Corner radius token of the field this sits inside (e.g. `var(--radius-button)`). */
  fieldRadius?: string;
  /** `compact` fits `h-9` wells (2px inset / gap). */
  density?: "default" | "compact";
  upLabel?: string;
  downLabel?: string;
  className?: string;
}) {
  const gap = STEPPER_GAP_PX[density];
  const radius = `calc(${fieldRadius} - ${gap}px)`;
  const innerRadius = `calc((${fieldRadius} - ${gap}px) / 2)`;
  const compact = density === "compact";

  return (
    <span
      className={cn(
        "absolute flex flex-col",
        compact
          ? "inset-y-0.5 right-0.5 w-6 gap-0.5"
          : "inset-y-1 right-1 w-7 gap-1",
        className
      )}
    >
      <button
        type="button"
        aria-label={upLabel}
        disabled={disabled}
        onClick={onStepUp}
        className={buttonClass}
        style={{
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          borderBottomLeftRadius: innerRadius,
          borderBottomRightRadius: innerRadius,
        }}
      >
        <Plus className={compact ? "size-2.5" : "size-3"} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label={downLabel}
        disabled={disabled}
        onClick={onStepDown}
        className={buttonClass}
        style={{
          borderTopLeftRadius: innerRadius,
          borderTopRightRadius: innerRadius,
          borderBottomLeftRadius: radius,
          borderBottomRightRadius: radius,
        }}
      >
        <Minus className={compact ? "size-2.5" : "size-3"} strokeWidth={2.5} />
      </button>
    </span>
  );
}
