"use client";

import { useMemo } from "react";
import { bookiePillStyle, type BookieChipStyle } from "@/lib/brands/bookies";
import { contrastText, EXCHANGE_PRESETS, pillBorderColor } from "@/lib/brands/exchanges";
import { useAppState } from "@/hooks/use-app-state";
import { cn } from "@/lib/utils";

function exchangePillStyle(name: string, override?: string | null): BookieChipStyle {
  const key = name.trim().toLowerCase();
  const preset = EXCHANGE_PRESETS.find((p) => p.name.toLowerCase() === key);
  const bg = override?.trim() || preset?.brandColor || "#3f3f46";
  return { bg, fg: contrastText(bg), border: pillBorderColor(bg) };
}

const EXCHANGE_KEYS = new Set(
  EXCHANGE_PRESETS.map((p) => p.name.toLowerCase())
);

const venueBadgeSizeClasses = {
  /** Calendar cards and compact rows */
  sm: "px-2 py-0.5 text-[10px] font-semibold leading-tight",
  /** Campaign cards — matches standard Badge (h-6, text-xs) */
  md: "h-6 px-2 text-xs font-medium leading-none",
} as const;

/**
 * Brand-coloured pill for a bookie or exchange.
 * Prefers Settings `brandColor` from Balances / Exchanges accounts;
 * falls back to the static brand palette.
 * Text-only pills (no logos) so they stay clear on light and dark.
 */
export function VenueBadge({
  name,
  brandColor,
  kind,
  size = "sm",
  className,
}: {
  name: string;
  /** Explicit override when the parent already has Settings colour */
  brandColor?: string | null;
  kind?: "bookie" | "exchange";
  size?: keyof typeof venueBadgeSizeClasses;
  className?: string;
}) {
  const trimmed = name.trim();
  const { state } = useAppState(0);

  const resolvedOverride = useMemo(() => {
    if (brandColor?.trim()) return brandColor.trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    const hit = state?.balances?.accounts?.find(
      (a) => a.name.toLowerCase() === key && a.brandColor?.trim()
    );
    return hit?.brandColor?.trim() ?? null;
  }, [brandColor, trimmed, state?.balances?.accounts]);

  if (!trimmed) return null;

  const accountKind = state?.balances?.accounts?.find(
    (a) => a.name.toLowerCase() === trimmed.toLowerCase()
  )?.type;
  const isExchange =
    kind === "exchange" ||
    accountKind === "exchange" ||
    (kind !== "bookie" && EXCHANGE_KEYS.has(trimmed.toLowerCase()));

  const style = isExchange
    ? exchangePillStyle(trimmed, resolvedOverride)
    : bookiePillStyle(trimmed, resolvedOverride);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full border",
        venueBadgeSizeClasses[size],
        className
      )}
      style={{
        backgroundColor: style.bg,
        color: style.fg,
        borderColor: style.border,
      }}
      title={trimmed}
    >
      {trimmed}
    </span>
  );
}
