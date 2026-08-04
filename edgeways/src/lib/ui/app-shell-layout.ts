/** Shared layout for top bar + nav + main panel row - matches CSS vars in globals.css */
/** Mobile is full-bleed (no shell gutters); the panel chrome returns at sm+. */
export const appShellPadding =
  "p-0 sm:px-[var(--layout-page-x)] sm:py-[var(--layout-page-x)]";
export const appShellGap = "gap-[var(--layout-shell-gap)]";
export const appNavColumn = "w-52 shrink-0 lg:w-56";
export const appNavInset = "px-3";
/**
 * Desktop-only app-wide cap so nav + content centre together as one unit on
 * wide/ultra-wide screens (Facebook-style), instead of the nav staying
 * pinned to the browser's left edge while only the content column narrows.
 * Below `md` the nav is hidden and the shell stays full-bleed, so this has
 * no effect on mobile. Shared by the top bar's inner row and the main shell
 * row - both must cap at the same width or the logo/nav column drift out of
 * alignment with the sidebar underneath.
 */
export const appShellMaxWidth = "md:mx-auto md:max-w-[1600px]";
