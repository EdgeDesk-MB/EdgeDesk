import { cn } from "@/lib/utils";

/** Tall desk create/edit shell: flex column, one scroll region, sticky footer. */
export const deskRunDialogContentClass = cn(
  "flex max-h-[90vh] max-w-lg flex-col gap-5 overflow-hidden sm:max-w-xl"
);

/** Inner scroller for DeskRunDialogBody (ScrollFadeEdges owns overflow). */
export const deskRunDialogBodyClass = cn(
  "app-scroll-nested flex min-h-0 flex-1 flex-col gap-5 pr-0.5"
);

/**
 * BackPanel / LayPanel / other overflow-hidden surfaces inside the scroll body.
 * Without shrink-0 + min-h-min they crush and clip (glass rim through mid-content).
 */
export const deskRunPanelClass = cn("min-h-min shrink-0");

/**
 * Legs / selections panel inside a height-capped dialog.
 * min-h-min stops panelSurface (overflow-hidden) from crushing under grid/flex min-size.
 */
export const deskRunLegsPanelClass = cn(
  "flex min-h-min min-w-0 shrink-0 flex-col gap-3 p-4"
);
