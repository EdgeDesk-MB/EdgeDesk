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

/**
 * Racing Desk horizontal inset — +4px vs the old `px-3` so Courses, race
 * chrome and the table share one right edge with filter pills / Add offer.
 */
export const deskInsetX = "px-4";

/**
 * Uniform band inset — matches Racing Desk “Track race” header padding
 * (desk horizontal inset, vertical `--layout-section-y`).
 */
export const deskBandPad = cn(
  deskInsetX,
  "py-[var(--layout-section-y)]"
);

/** Footer/legend band — same as deskBandPad but 8px less bottom padding. */
export const deskBandPadFooter = cn(
  deskInsetX,
  "pt-[var(--layout-section-y)] pb-1"
);

/** Section band inside a card (headers, tab bars) */
export const sectionBar = cn("border-b border-border/60", deskBandPad);

export const sectionMeta = cn("border-b border-border/60", deskBandPad);

/** Denser card shell for Racing Desk blocks (Courses, day P&L, …). */
export const deskCardShell = cn(
  "gap-[var(--layout-section-y)] py-[var(--layout-section-y)]",
  "[--card-spacing:1rem]"
);

/** Page-level title band - no extra horizontal inset (page shell already padded) */
export const pageSectionBar = cn(
  "border-b border-border/60",
  "py-[var(--layout-section-y)]"
);

export const pageSectionMeta = cn("border-b border-border/60 py-2.5");
