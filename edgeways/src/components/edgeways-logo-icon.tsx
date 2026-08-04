import { cn } from "@/lib/utils";

/** Bolt path traced from brand/masters/notification.png (7-point geometric mark). */
const BOLT_PATH =
  "M12.82 4.32 L12.86 10.3 L18.91 10.3 L11.25 19.61 L11.14 13.7 L5.13 13.67 L12.75 4.39 Z";

/**
 * Edgeways brand mark — yellow bolt on ink plate.
 * Use alone as the top-bar logo (no separate wordmark text).
 */
export function EdgewaysLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn("size-7 shrink-0", className)}
      aria-hidden
    >
      <rect width="24" height="24" rx="5" fill="#111111" />
      <path d={BOLT_PATH} fill="#FFC71E" />
    </svg>
  );
}
