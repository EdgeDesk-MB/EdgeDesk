"use client";

import { cn } from "@/lib/utils";
import type { PriceMovement } from "@/lib/racing-desk/types";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

/** Inline steamer/drifter arrow when local snapshots exist. */
export function PriceMovementArrow({
  movement,
  className,
}: {
  movement?: PriceMovement;
  className?: string;
}) {
  if (!movement?.current || movement.snapshotCount < 2) return null;

  const change = movement.change;
  const isSteamer = change != null && change < -0.05;
  const isDrifter = change != null && change > 0.05;

  if (!isSteamer && !isDrifter) return null;

  const Icon = isSteamer ? TrendingDown : TrendingUp;

  return (
    <span
      className={cn(
        "inline-flex items-center",
        isSteamer && "text-emerald-600 dark:text-emerald-400",
        isDrifter && "text-red-600 dark:text-red-400",
        className
      )}
      title={
        movement.open != null
          ? `${movement.open.toFixed(2)} → ${movement.current.toFixed(2)}`
          : undefined
      }
    >
      <Icon className="size-3" aria-hidden />
    </span>
  );
}

export function PriceMovementBadge({
  movement,
  className,
  compact,
}: {
  movement?: PriceMovement;
  className?: string;
  compact?: boolean;
}) {
  if (!movement?.current) {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }

  const change = movement.change;
  const isSteamer = change != null && change < -0.05;
  const isDrifter = change != null && change > 0.05;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-end gap-0.5 text-[10px] font-medium tabular-nums",
          isSteamer && "text-emerald-600 dark:text-emerald-400",
          isDrifter && "text-red-600 dark:text-red-400",
          !isSteamer && !isDrifter && "text-muted-foreground",
          className
        )}
      >
        {isSteamer ? (
          <TrendingDown className="size-3" aria-hidden />
        ) : isDrifter ? (
          <TrendingUp className="size-3" aria-hidden />
        ) : null}
        {movement.current.toFixed(2)}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <span className="text-sm font-semibold tabular-nums">{movement.current.toFixed(2)}</span>
      {change != null && movement.open != null && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
            isSteamer && "text-emerald-600 dark:text-emerald-400",
            isDrifter && "text-red-600 dark:text-red-400",
            !isSteamer && !isDrifter && "text-muted-foreground"
          )}
        >
          {isSteamer ? (
            <TrendingDown className="size-3" aria-hidden />
          ) : isDrifter ? (
            <TrendingUp className="size-3" aria-hidden />
          ) : (
            <Minus className="size-3" aria-hidden />
          )}
          {change >= 0 ? "+" : ""}
          {change.toFixed(2)}
          {movement.changePct != null && (
            <span className="opacity-80">
              ({movement.changePct >= 0 ? "+" : ""}
              {movement.changePct.toFixed(1)}%)
            </span>
          )}
        </span>
      )}
      {movement.history.length > 1 && (
        <Sparkline values={movement.history} steamer={isSteamer} drifter={isDrifter} />
      )}
    </div>
  );
}

function Sparkline({
  values,
  steamer,
  drifter,
}: {
  values: number[];
  steamer: boolean;
  drifter: boolean;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 48;
  const h = 14;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="opacity-80" aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={cn(
          steamer && "text-emerald-500",
          drifter && "text-red-500",
          !steamer && !drifter && "text-muted-foreground"
        )}
        points={points}
      />
    </svg>
  );
}
