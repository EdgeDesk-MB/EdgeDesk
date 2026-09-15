import { cn } from "@/lib/utils";

/**
 * App-wide layout spacing - driven by CSS vars in globals.css:
 * --layout-page-x, --layout-card-x, --layout-stack-gap
 */

/** Page shell outer inset. Split so a later `pb-*` (calculator end air) does not drop the sides. */
export const pageShell = cn(
  "px-[var(--layout-page-x)] pt-[var(--layout-page-x)] pb-[var(--layout-page-x)]",
  "gap-[var(--layout-stack-gap)]"
);

export const pageShellCompact = cn(
  "gap-0 p-0"
);

/** Card internal horizontal inset - keep in sync with Card --card-spacing */
export const cardInsetX = "px-[var(--layout-card-x)]";

/** Cancel CardContent inset so a hairline list can bleed to the plate edge. */
export const cardBleedX = "-mx-[var(--layout-card-x)]";

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

/**
 * Mobile Home swipe-deck section headers (`DashboardSectionHeader`).
 * Fixed `--home-deck-header-h` below `sm` so Do next (sort tabs) and
 * title-only cards share one bar; title and actions sit on the midline.
 */
export const homeDeckSectionHeader = cn(
  "max-sm:box-border max-sm:flex max-sm:h-[var(--home-deck-header-h)] max-sm:items-center max-sm:py-0"
);

/** Floor for the P&L plot on mobile Summary so the card does not collapse. */
export const homeDeckChartMinH = "min-h-[var(--home-deck-chart-min-h)]";

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
