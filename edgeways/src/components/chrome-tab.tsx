import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Chrome-style tab plate: rounded leading edge + concave ears that flare into
 * the surrounding strip (modern Chrome tab geometry).
 *
 * - `rise` — meta-nav: rounded top, ears at the bottom (`--chrome-tab-r`).
 *   Full-bleed (`max-sm`): `--page` so the tab matches the flush page panel.
 *   Inset shell (`sm+`): `--canvas` so the tab matches the shell around the
 *   rounded page panel.
 * - `hang` — balance pill: rounded bottom, ears at the top (same recipe as
 *   rise, mirrored). Uses larger `--chrome-tab-r-hang`.
 *
 * Ears: circle + spread shadow + clip-path quarter (Chrome-tab CSS recipe).
 */
export function ChromeTab({
  edge,
  className,
  style,
  children,
}: {
  edge: "rise" | "hang";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const hang = edge === "hang";
  const rVar = hang ? "var(--chrome-tab-r-hang)" : "var(--chrome-tab-r)";

  return (
    <div
      className={cn("relative overflow-visible", className)}
      style={style}
      data-chrome-tab={edge}
    >
      <div
        aria-hidden
        className={cn(
          /* Skeuo 3D on the free edge — top for rise, bottom for hang (see globals). */
          "chrome-tab-plate absolute inset-0",
          hang
            ? "bg-canvas rounded-b-[var(--chrome-tab-r-hang-bottom)]"
            : "bg-page sm:bg-canvas rounded-t-[var(--chrome-tab-r)]"
        )}
      />
      <ChromeTabEar side="left" hang={hang} rVar={rVar} />
      <ChromeTabEar side="right" hang={hang} rVar={rVar} />
      {children ? (
        <div className="relative z-[1] flex h-full min-h-0 w-full items-stretch">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One concave ear — same recipe for rise (bottom) and hang (top).
 * Circle of tab fill via box-shadow, clipped to the quarter against the corner.
 */
function ChromeTabEar({
  side,
  hang,
  rVar,
}: {
  side: "left" | "right";
  hang: boolean;
  rVar: string;
}) {
  const left = side === "left";

  return (
    <span
      aria-hidden
      className={cn(
        /* Shine rim on ::after in globals (fade out at free edge). */
        "chrome-tab-ear pointer-events-none absolute z-[2] block rounded-full",
        // Hang / sm+ rise: canvas. Full-bleed rise: page.
        hang
          ? "shadow-[0_0_0_40px_var(--canvas)]"
          : "shadow-[0_0_0_40px_var(--page)] sm:shadow-[0_0_0_40px_var(--canvas)]",
        // Rise ears sit 1px above the plate bottom so the concave joins the
        // topbar strip cleanly.
        hang ? "top-0" : "bottom-[1px]",
        // Quarter toward the tab. Rise = bottom quarters; hang = top quarters.
        !hang && left && "[clip-path:inset(50%_-2px_0_50%)]",
        !hang && !left && "[clip-path:inset(50%_50%_0_-2px)]",
        hang && left && "[clip-path:inset(0_-2px_50%_50%)]",
        hang && !left && "[clip-path:inset(0_50%_50%_-2px)]"
      )}
      style={{
        width: rVar,
        height: rVar,
        left: left ? `calc(-1 * ${rVar})` : undefined,
        right: left ? undefined : `calc(-1 * ${rVar})`,
      }}
    />
  );
}
