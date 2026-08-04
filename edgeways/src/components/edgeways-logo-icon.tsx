import { cn } from "@/lib/utils";

/** Bolt path traced from brand/masters/notification.png (7-point geometric mark). */
const BOLT_PATH =
  "M12.82 4.32 L12.86 10.3 L18.91 10.3 L11.25 19.61 L11.14 13.7 L5.13 13.67 L12.75 4.39 Z";

/**
 * Compact Edgeways mark — ink bolt on yellow plate.
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
      <rect width="24" height="24" rx="5" fill="#FFC71E" />
      <path d={BOLT_PATH} fill="#111111" />
    </svg>
  );
}

/**
 * Full Edgeways lockup — ink bolt + "edgeways" wordmark.
 * Used on the yellow top bar. Source: brand/masters/logo-dark.png.
 */
export function EdgewaysLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand lockup; aspect preserved via h-* + w-auto
    <img
      src="/brand/logo.png"
      alt=""
      aria-hidden
      className={cn("h-7 w-auto shrink-0", className)}
    />
  );
}
