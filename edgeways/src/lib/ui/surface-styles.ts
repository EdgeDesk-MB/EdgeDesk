import { cn } from "@/lib/utils";

/** Untitled UI–style raised control (inset lip + soft drop) — outline / secondary */
export const skeuo = "skeuo";

/** Raised solid fill with top highlight bevel — primary / ink chips */
export const skeuoSolid = "skeuo-solid";

/**
 * Field plate — Input/textarea rest recessed (button pressed face);
 * SelectTrigger / VenueSelect rest raised and press on open.
 * Behaviour lives on `.field-control` in globals.css.
 */
export const fieldControl = cn(
  "skeuo-solid field-control rounded-[var(--radius-button)] border-transparent bg-[#eeeeee] dark:bg-input/30"
);

/** White card lifted above the grey-blue page surface */
export const surfaceLift = cn(
  "surface-lift bg-card text-card-foreground ring-1 ring-border/50 dark:ring-border/60"
);

/** Main centred page panel - grey-blue, sits on the canvas shell */
export const pagePanel = cn(
  "page-panel overflow-hidden bg-page text-foreground ring-1 ring-border/50 dark:ring-border/60"
);

/** Nested full-width panel on the page - white lifted block */
export const pageSurface = cn(
  surfaceLift,
  "overflow-hidden rounded-[var(--layout-page-radius)]"
);

/** Lighter grey - hover states, secondary bars, section headers on white */
export const selectionSubtle = "bg-selection-subtle";

/** Muted grey band - matches the "Campaign P&L" header strip on Acca run cards
 * and the Tracker's campaign grouping. Neutral alternative to a coloured panel
 * when there's no exchange/bookie to tint from. */
export const campaignHeaderBand = "bg-muted/50 dark:bg-input/30";

/** Stronger grey - selected / active items */
export const selectionSubdued = "bg-selection-subdued";

export const pageTitle = "text-xl font-bold tracking-tight text-foreground";

export const sectionTitle =
  "text-xs font-bold uppercase tracking-wide text-foreground";

export const sectionDescription = "text-[11px] text-muted-foreground";

/** Small uppercase caption for nav sections and column headers outside tables */
export const captionHeading =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

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
  "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
);

export function navLinkState(active: boolean) {
  return cn(
    navLink,
    active
      ? "font-semibold text-primary-text"
      : "text-muted-foreground hover:text-foreground"
  );
}

/**
 * Brand secondary accent — ink plate (#111) + readable brand type (`--brand-text`).
 * Active filter pills, segmented tabs, primary chips. Raised (skeuo).
 * Weight stays semibold so active/inactive pills don’t jump in width.
 */
export const brandChipActive =
  "skeuo-solid skeuo-sm bg-[#111111] font-semibold text-brand-text";

/**
 * Counters / nav badges — flat.
 * Light: ink plate + secondary-button off-white type.
 * Dark: secondary plate + contrast-safe brand type (`--brand-text`).
 */
export const brandChipCount =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#111111] px-1.5 text-[10px] font-bold tabular-nums text-[#fafafa] dark:bg-secondary dark:text-brand-text";

/** Tiny Pro tier mark beside nav section labels — brand plate + contrast type. */
export const proNavTag =
  "inline-flex items-center rounded-[3px] bg-brand px-1 pt-[2px] pb-[2px] text-[9px] font-bold uppercase leading-none tracking-wide text-brand-foreground";

/**
 * Tiny Edge tier mark — same geometry as `proNavTag`, Offer Edge violet plate.
 * Contrast type via `--edge-foreground` (white in light, ink in dark).
 */
export const edgeNavTag =
  "inline-flex items-center rounded-[3px] bg-edge px-1 pt-[2px] pb-[2px] text-[9px] font-bold uppercase leading-none tracking-wide text-edge-foreground";

/**
 * Brand-plate counter for sitting on ink (e.g. active filter pills).
 * Prefer `filterPillCountState` inside filter pills so active/inactive share size.
 */
export const brandChipCountOnInk =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold tabular-nums text-brand-foreground";

/** Fixed-size counter shell used by filterPillCountState (active + inactive). */
export const filterPillCount =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums";

/** Counter chip for filter pills — same box either state so selection doesn’t jump. */
export function filterPillCountState(active: boolean) {
  return cn(
    filterPillCount,
    active
      ? "bg-brand text-brand-foreground"
      : "bg-foreground/10 text-foreground/70"
  );
}

/** @deprecated Prefer brandChipCount */
export const brandChipCountInverse = brandChipCount;

/** @deprecated Prefer brandChipActive — kept for any stray imports */
export const monoAccentActive = brandChipActive;

/**
 * Flashscore-style filter / tab pills (class recipe).
 * Prefer `<FilterPill>` for pressable page filters — it uses PressButton.
 * Keep this helper for compact Home chips and dense one-offs.
 * `hasCount`: 4px less right pad (`pr-2` vs `px-3`) so the chip sits tighter;
 * default pills use `min-h-8` so rows with/without counters share height.
 * `compact`: denser Home Chart / History feed chips (no 3D press).
 */
export function filterPillState(
  active: boolean,
  opts?: { hasCount?: boolean; compact?: boolean }
) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-page",
    opts?.compact
      ? "min-h-0 px-2.5 py-[6px] text-[10px] leading-none"
      : cn(
          "min-h-8 py-1.5 text-xs",
          opts?.hasCount ? "pl-3 pr-2" : "px-3"
        ),
    active
      ? cn(
          brandChipActive,
          /* Keep brand type on hover/focus — never fall back to foreground on ink */
          "hover:bg-[#111111] hover:text-brand-text focus-visible:text-brand-text active:bg-[#111111] active:text-brand-text"
        )
      : "bg-muted/60 text-foreground/75 hover:bg-muted hover:text-foreground dark:bg-input/30 dark:hover:bg-input/50"
  );
}

/** Layout wrapper for a row of filterPillState buttons (pills carry their own fill) */
export const filterPillGroup = cn(
  "inline-flex flex-wrap items-center gap-1.5"
);

/**
 * Campaign-style card chrome — outer ring + white 1px inset via
 * `.offer-campaign-card::after` (see globals.css).
 */
export const offerCampaignCardShell = cn(
  "offer-campaign-card group relative flex overflow-hidden rounded-lg bg-card text-left transition-colors",
  "ring-1 ring-border/50 dark:ring-[color-mix(in_oklch,black_55%,var(--border))] dark:ring-opacity-100",
  "hover:brightness-[0.98] dark:hover:brightness-110"
);

/** Calendar cards — same shell; left inset skips the priority bar column */
export const offerCalendarCardShell = cn(offerCampaignCardShell, "offer-calendar-card");

/** Count pill for Offer Edge recommended races / offers (pro signature). */
export const edgeMarkerPill =
  "inline-flex min-w-[1rem] items-center justify-center gap-0.5 rounded-full bg-edge/15 px-1 text-[9px] font-bold tabular-nums text-edge";

/** Soft panel chrome for Edge recommendations (workflow, Edge today). */
export const edgePanel =
  "rounded-md border border-edge/25 bg-edge/5";

export const edgePanelStrong =
  "rounded-md border border-edge/45 bg-edge/10 ring-1 ring-edge/30";
