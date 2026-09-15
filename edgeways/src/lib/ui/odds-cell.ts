import type { CSSProperties } from "react";
import { muteForDark } from "@/lib/brands/exchanges";

/**
 * Exchange-branded odds cell — light hex as-is, dark via the same
 * `muteForDark` mix as Back/Lay plates (hue held, pastel in dark).
 */
export function oddsCellStyle(hex?: string): CSSProperties | undefined {
  if (!hex) return undefined;
  return {
    "--odds-cell": hex,
    "--odds-cell-dark": muteForDark(hex),
  } as CSSProperties;
}

export const oddsCellClass =
  "bg-[var(--odds-cell)] text-black/85 dark:bg-[var(--odds-cell-dark)] dark:text-white/95";
