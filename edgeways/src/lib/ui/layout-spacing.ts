import { cn } from "@/lib/utils";

/**
 * App-wide layout spacing - driven by CSS vars in globals.css:
 * --layout-page-x, --layout-card-x, --layout-stack-gap
 */

/** Page shell outer inset - uniform on all sides (title, cards, grids align to this edge) */
export const pageShell = cn(
  "p-[var(--layout-page-x)]",
  "gap-[var(--layout-stack-gap)]"
);

export const pageShellCompact = cn(
  "gap-0 p-0"
);

/** Card internal horizontal inset - keep in sync with Card --card-spacing */
export const cardInsetX = "px-[var(--layout-card-x)]";

/** Section band inside a card (headers, tab bars) */
export const sectionBar = cn(
  "border-b border-border/60",
  cardInsetX,
  "py-[var(--layout-section-y)]"
);

export const sectionMeta = cn(
  "border-b border-border/60",
  cardInsetX,
  "py-2.5"
);

/** Page-level title band - no extra horizontal inset (page shell already padded) */
export const pageSectionBar = cn(
  "border-b border-border/60",
  "py-[var(--layout-section-y)]"
);

export const pageSectionMeta = cn("border-b border-border/60 py-2.5");
