import { cn } from "@/lib/utils";

/** White card lifted above the grey-blue page surface */
export const surfaceLift = cn(
  "surface-lift bg-card text-card-foreground ring-1 ring-border/50 dark:ring-border/60"
);

/** Main centred page panel — grey-blue, sits on the canvas shell */
export const pagePanel = cn(
  "page-panel bg-page text-foreground ring-1 ring-border/50 dark:ring-border/60"
);

/** Nested full-width panel on the page — white lifted block */
export const pageSurface = cn(surfaceLift, "overflow-hidden rounded-lg");

/** Lighter grey — hover states, secondary bars, section headers on white */
export const selectionSubtle = "bg-selection-subtle";

/** Stronger grey — selected / active items */
export const selectionSubdued = "bg-selection-subdued";

export const pageTitle = "text-xl font-bold tracking-tight text-foreground";

export const sectionTitle =
  "text-xs font-bold uppercase tracking-wide text-foreground";

export const sectionDescription = "text-[11px] text-muted-foreground";

export const tableHeaderCell =
  "h-8 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export const tableBodyCell = "px-2 py-2 align-middle";

export const listRow =
  "border-b border-border/60 transition-colors hover:bg-selection-subtle";

export const listRowInteractive = cn(
  "rounded-md border border-transparent transition-colors",
  "hover:bg-selection-subtle"
);

export function listRowSelected(active: boolean) {
  return cn(
    listRowInteractive,
    active &&
      "border-selection-subdued-border bg-selection-subdued text-foreground"
  );
}

export const listPill = cn(
  "shrink-0 rounded border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors"
);

export function listPillState(active: boolean) {
  return cn(
    listPill,
    active
      ? "border-selection-subdued-border bg-selection-subdued text-foreground"
      : "border-transparent bg-card/80 text-muted-foreground hover:border-border hover:bg-selection-subtle"
  );
}

export { sectionBar, sectionMeta } from "@/lib/ui/layout-spacing";

export const navLink = cn(
  "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
);

export function navLinkState(active: boolean) {
  return cn(
    navLink,
    active
      ? "font-semibold text-foreground"
      : "text-muted-foreground hover:text-foreground"
  );
}

/** Flashscore-style filter / tab pills */
export function filterPillState(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
    active
      ? "bg-primary text-primary-foreground shadow-sm"
      : "bg-muted text-muted-foreground hover:text-foreground"
  );
}
