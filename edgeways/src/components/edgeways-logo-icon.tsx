import { BOLT_PATH } from "@/lib/brand/bolt-mark";
import { cn } from "@/lib/utils";

/**
 * Compact Edgeways mark — contrast bolt on brand plate.
 * For small slots (menu header, PWA prompt). Top bar uses EdgewaysLogo.
 */
export function EdgewaysLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn("size-7 shrink-0", className)}
      aria-hidden
    >
      <rect width="24" height="24" rx="5" fill="var(--brand)" />
      <path d={BOLT_PATH} fill="var(--brand-on-topbar)" />
    </svg>
  );
}

/**
 * Full Edgeways lockup — ink bolt + "edgeways" wordmark.
 * - default: ink lockup (`logo.png`)
 * - `onDark`: yellow lockup for ink surfaces (`logo-yellow.png`)
 * - `topbar`: colour via `--brand-logo` (light) / `--brand-on-topbar` (dark),
 *   masked from the yellow lockup so accent + contrast rules apply.
 */
export function EdgewaysLogo({
  className,
  onDark = false,
  topbar = false,
}: {
  className?: string;
  onDark?: boolean;
  topbar?: boolean;
}) {
  const imgClass = cn("h-[2.1rem] w-auto shrink-0", className);

  if (topbar) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-block h-[2.1rem] w-[8.15rem] shrink-0",
          "bg-brand-logo dark:bg-brand-on-topbar",
          "[mask-image:url(/brand/logo-yellow.png)] [mask-size:contain] [mask-repeat:no-repeat] [mask-position:left_center]",
          "[-webkit-mask-image:url(/brand/logo-yellow.png)] [-webkit-mask-size:contain] [-webkit-mask-repeat:no-repeat] [-webkit-mask-position:left_center]",
          className
        )}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand lockup; aspect preserved via h-* + w-auto
    <img
      src={onDark ? "/brand/logo-yellow.png" : "/brand/logo.png"}
      alt=""
      aria-hidden
      className={imgClass}
    />
  );
}
