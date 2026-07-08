/** Dashboard — single white page, sections split by grey dividers (no per-section borders). */

export const dashboardPage =
  "flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent";

/** Column / panel inside the dashboard grid */
export const dashboardSection =
  "flex h-full max-h-full min-h-0 flex-col overflow-hidden bg-transparent shadow-none ring-0";

/** Scrollable panel body (history, tab lists) */
export const dashboardPanelBody = "app-scroll-nested min-h-0 flex-1 overflow-y-auto";

/** Chart body — must not grow with chart content */
export const dashboardPanelFillBody =
  "flex min-h-0 flex-1 flex-col overflow-hidden";

export const dashboardPanelColumn =
  "flex h-full max-h-full min-h-0 flex-col overflow-hidden";

/** Main grid below the overview metrics band */
export const dashboardMainGrid =
  "grid min-h-0 flex-1 grid-rows-1 overflow-hidden divide-border/60 lg:grid-cols-2 lg:divide-x xl:grid-cols-12";

/** @deprecated use dashboardSection */
export const dashboardPanelCard = dashboardSection;
