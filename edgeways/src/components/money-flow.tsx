"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { evFractionDigits } from "@/lib/format-money";
import { OFFER_INACTIVE_FIGURE_CLASS } from "@/lib/offers/offer-inactive-ui";
import { cn } from "@/lib/utils";

/**
 * Snappy discrete updates. Continuous scrubbing (underlay slider) disables
 * animation via {@link useAnimateMoneyFlow} so spins never stack.
 */
const timings = {
  transformTiming: { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  spinTiming: { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  opacityTiming: { duration: 100, easing: "ease-out" },
} as const;

/** Updates closer than this are treated as scrubbing — jump, don't spin. */
const RAPID_UPDATE_MS = 90;

/**
 * Detect slider/drag-style value floods. Derived during render (no effect lag)
 * so the first rapid frame already skips NumberFlow animation.
 */
function useAnimateMoneyFlow(value: number, enabled: boolean): boolean {
  const [tracker, setTracker] = useState({ value, recent: false });

  useEffect(() => {
    if (!tracker.recent) return;
    const timer = window.setTimeout(
      () => setTracker((t) => (t.recent ? { ...t, recent: false } : t)),
      RAPID_UPDATE_MS
    );
    return () => window.clearTimeout(timer);
  }, [tracker]);

  if (!enabled) return false;
  if (value !== tracker.value) {
    const animate = !tracker.recent;
    setTracker({ value, recent: true });
    return animate;
  }
  return true;
}

/**
 * Price-ticker style number: only the digits AFTER the decimal point animate.
 * The integer part is plain text that swaps instantly - so £154.10 → £155.32
 * ticks the pennies while the pounds just update, like a stock price.
 *
 * trend={0} on the animated fraction: each digit takes its own shortest path
 * (wrapping 9→0 is a single step), so 10p → 32p never cycles the long way round.
 *
 * Inactive/expired figures skip NumberFlow so text-decoration can strike the
 * whole amount (NumberFlow's shadow-DOM digits do not inherit line-through).
 */
function SplitFlow({
  value,
  digits,
  prefix = "",
  suffix = "",
  className,
  signColor,
  signDisplay,
  animateFraction = true,
}: {
  value: number;
  digits: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  signColor?: boolean;
  signDisplay?: boolean;
  animateFraction?: boolean;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const scale = 10 ** digits;
  // Round first, then split, so 9.999 becomes 10 + .00 rather than 9 + .100
  const totalUnits = Math.round(Math.abs(safe) * scale);
  const negative = safe < 0 && totalUnits > 0;
  const positive = safe > 0 && totalUnits > 0;
  const intPart = Math.floor(totalUnits / scale);
  const fracPart = totalUnits % scale;
  const fracText = String(fracPart).padStart(digits, "0");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  // NumberFlow's custom element is HTML on the client and text on the server.
  const liveFlow = mounted && animateFraction && digits > 0;
  const animated = useAnimateMoneyFlow(fracPart, liveFlow);

  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        signColor && (positive ? moneyPositiveClass : negative ? "text-negative" : ""),
        className
      )}
    >
      {negative ? "-" : signDisplay && positive ? "+" : ""}
      {prefix}
      {intPart.toLocaleString("en-GB")}
      {digits > 0 &&
        (liveFlow ? (
          <>
            .
            <NumberFlow
              value={fracPart}
              trend={0}
              animated={animated}
              {...timings}
              format={{ minimumIntegerDigits: digits, useGrouping: false }}
            />
          </>
        ) : (
          // Reserve NumberFlow's own vertical padding (mask fade allowance) up front,
          // so mounting it doesn't grow the row height a beat after first paint.
          <span className={animateFraction ? "inline-block py-[0.25em]" : undefined}>
            .{fracText}
          </span>
        ))}
      {suffix}
    </span>
  );
}

/** Positive money green, shared by MoneyFlow signColor and static P&L labels. */
export const moneyPositiveClass = "text-profit";

interface MoneyFlowProps {
  value: number;
  className?: string;
  /** Colour the number by its sign (green positive / red negative) */
  signColor?: boolean;
  /** Show an explicit + for positive values */
  signDisplay?: boolean;
  compact?: boolean;
  /** EV / estimate surfaces: whole pounds without decimals, otherwise two dp */
  estimate?: boolean;
}

/**
 * Animated GBP amount - every changing money value in the app goes through this.
 * Pounds swap instantly; only the pence animate (skipped while scrubbing).
 */
export function MoneyFlow({
  value,
  className,
  signColor,
  signDisplay,
  compact,
  estimate,
}: MoneyFlowProps) {
  const safe = Number.isFinite(value) ? value : 0;
  if (compact) {
    // Compact notation ("£1.2K") has no stable decimal part to isolate - no animation.
    return (
      <span
        className={cn(
          "tabular-nums",
          signColor && (safe > 0.004 ? moneyPositiveClass : safe < -0.004 ? "text-negative" : ""),
          className
        )}
      >
        {new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "GBP",
          notation: "compact",
          signDisplay: signDisplay ? "exceptZero" : "auto",
        }).format(safe)}
      </span>
    );
  }
  const animateFraction = !className?.includes(OFFER_INACTIVE_FIGURE_CLASS);
  const digits = estimate ? evFractionDigits(safe) : 2;
  return (
    <SplitFlow
      value={safe}
      digits={digits}
      prefix="£"
      className={className}
      signColor={signColor}
      signDisplay={signDisplay}
      animateFraction={animateFraction}
    />
  );
}

interface PercentFlowProps {
  value: number;
  className?: string;
  signColor?: boolean;
  digits?: number;
}

export function PercentFlow({ value, className, signColor, digits = 2 }: PercentFlowProps) {
  const animateFraction = !className?.includes(OFFER_INACTIVE_FIGURE_CLASS);
  return (
    <SplitFlow
      value={value}
      digits={digits}
      suffix="%"
      className={className}
      signColor={signColor}
      signDisplay
      animateFraction={animateFraction}
    />
  );
}

export function NumFlow({
  value,
  className,
  digits = 2,
}: {
  value: number;
  className?: string;
  digits?: number;
}) {
  const animateFraction = !className?.includes(OFFER_INACTIVE_FIGURE_CLASS);
  return (
    <SplitFlow
      value={value}
      digits={digits}
      className={className}
      animateFraction={animateFraction}
    />
  );
}
