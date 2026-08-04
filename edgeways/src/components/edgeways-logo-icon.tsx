import { cn } from "@/lib/utils";

/**
 * Placeholder brand mark: chamfered lightning bolt (filled, currentColor).
 * Swap the path when the final Edgeways mark lands; keep the API identical.
 */
export function EdgewaysLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-[18px] shrink-0", className)}
      aria-hidden
    >
      <path d="M13.6 1.5 4.4 13.4h5.4L9.1 22.5l9.9-12.4h-5.8l0.4-8.6Z" />
    </svg>
  );
}
